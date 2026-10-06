import type { Context } from 'hono';
import { stream } from 'hono/streaming';

/**
 * Live checklists for long wizard actions (updating the database, building, uploading to GitHub, updating TeamHub).
 * A route reports each step as it starts and ends; when the browser asks for `application/x-ndjson`, every change is
 * sent right away as one JSON line, so the page shows exactly which step is running. Other callers (tests, scripts)
 * get the usual single JSON answer.
 */
export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';
export interface ProgressStep {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

export interface Progress {
  /** Add steps to the checklist (they show as "pending" until they run). */
  plan(steps: { id: string; label: string }[]): void;
  set(id: string, status: StepStatus, detail?: string): void;
  /** Runs `fn` as step `id`: shown running, then done (or failed, and the error is re-thrown). */
  step<T>(id: string, fn: () => Promise<T>, detail?: (result: T) => string | undefined): Promise<T>;
  /** Marks every step that never ran as skipped (after a failure, nothing else happens). */
  skipRest(detail?: string): void;
}

export function createProgress(onChange: (steps: ProgressStep[]) => void = () => {}): Progress & { steps: ProgressStep[] } {
  const steps: ProgressStep[] = [];
  const emit = () => onChange(steps.map((s) => ({ ...s })));
  const p = {
    steps,
    plan(list: { id: string; label: string }[]) {
      for (const s of list) if (!steps.some((x) => x.id === s.id)) steps.push({ ...s, status: 'pending' as StepStatus });
      emit();
    },
    set(id: string, status: StepStatus, detail?: string) {
      const s = steps.find((x) => x.id === id);
      if (!s) return;
      s.status = status;
      if (detail !== undefined) s.detail = detail;
      emit();
    },
    async step<T>(id: string, fn: () => Promise<T>, detail?: (result: T) => string | undefined): Promise<T> {
      p.set(id, 'running');
      try {
        const r = await fn();
        p.set(id, 'done', detail?.(r));
        return r;
      } catch (e) {
        p.set(id, 'failed', (e as Error).message);
        throw e;
      }
    },
    skipRest(detail?: string) {
      for (const s of steps) if (s.status === 'pending') s.status = 'skipped';
      if (detail) {
        const first = steps.find((s) => s.status === 'skipped');
        if (first) first.detail = detail;
      }
      emit();
    },
  };
  return p;
}

/** A route's answer with an HTTP status (e.g. 409 for an update that conflicts). */
export function withStatus<T>(body: T, status: number) {
  return { __status: status, body };
}
type Answer = unknown | { __status: number; body: unknown };

/**
 * Answers with a live checklist when the browser asks for one, otherwise with plain JSON. `run` returns the final
 * answer; thrown errors become an `error` line (or the app's normal error response).
 */
export function respondWithProgress(c: Context, run: (p: Progress) => Promise<Answer>) {
  const unwrap = (a: Answer) => (a && typeof a === 'object' && '__status' in a ? (a as { __status: number; body: unknown }) : { __status: 200, body: a });
  if (!(c.req.header('accept') ?? '').includes('application/x-ndjson')) {
    return run(createProgress()).then((a) => {
      const { __status, body } = unwrap(a);
      return c.json(body as object, __status as 200);
    });
  }
  c.header('content-type', 'application/x-ndjson; charset=utf-8');
  c.header('cache-control', 'no-store');
  return stream(c, async (s) => {
    // Writes are queued so lines never interleave, however fast steps change.
    let queue = Promise.resolve();
    const send = (o: unknown) => (queue = queue.then(() => s.write(`${JSON.stringify(o)}\n`).then(() => undefined)));
    const p = createProgress((steps) => void send({ type: 'steps', steps }));
    try {
      const { __status, body } = unwrap(await run(p));
      send({ type: 'result', status: __status, body });
    } catch (e) {
      p.skipRest();
      const status = (e as { status?: number }).status ?? 500;
      send({ type: 'error', status, message: (e as Error).message || 'Something went wrong.' });
    }
    await queue;
  });
}
