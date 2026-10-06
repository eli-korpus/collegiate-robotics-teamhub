import { useState, type ReactNode } from 'react';
import { ArrowRight, Check, CheckCircle2, Circle, Loader2, MinusCircle, RotateCcw, XCircle } from 'lucide-react';
import { Button, cn } from '@teamhub/ui';
import { apiProgress, type ProgressStep } from './api';

/**
 * Live checklist for long actions (database, test build, GitHub upload, TeamHub update): every step, which one is
 * running now, what finished, and what failed. Screen readers hear the current step.
 */
export function Checklist({ steps, className }: { steps: ProgressStep[]; className?: string }) {
  if (!steps.length) return null;
  const current = steps.find((s) => s.status === 'running') ?? steps.find((s) => s.status === 'failed');
  const finished = steps.filter((s) => s.status === 'done' || s.status === 'skipped').length;
  return (
    <div className={cn('rounded-md border border-border bg-surface p-3', className)}>
      <p className="mb-2 text-[12px] font-medium text-muted" aria-live="polite">
        {current?.status === 'failed'
          ? `Stopped at: ${current.label}`
          : current
            ? `Step ${steps.indexOf(current) + 1} of ${steps.length}: ${current.label}`
            : finished === steps.length
              ? `All ${steps.length} steps done`
              : `${finished} of ${steps.length} steps done`}
      </p>
      <ol className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.id} className="flex items-start gap-2 text-[13px]">
            <StepIcon status={s.status} />
            <span className="min-w-0">
              <span
                className={cn(
                  s.status === 'running' && 'font-medium',
                  s.status === 'failed' && 'font-medium text-danger',
                  (s.status === 'pending' || s.status === 'skipped') && 'text-muted',
                )}
              >
                {s.label}
                {s.status === 'skipped' && ' (skipped)'}
              </span>
              {s.detail && <span className={cn('block break-words text-[12px]', s.status === 'failed' ? 'text-danger' : 'text-muted')}>{s.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepIcon({ status }: { status: ProgressStep['status'] }) {
  const cls = 'mt-0.5 size-4 shrink-0';
  if (status === 'running') return <Loader2 className={cn(cls, 'animate-spin text-accent')} aria-label="Running" />;
  if (status === 'done') return <CheckCircle2 className={cn(cls, 'text-success')} aria-label="Done" />;
  if (status === 'failed') return <XCircle className={cn(cls, 'text-danger')} aria-label="Failed" />;
  if (status === 'skipped') return <MinusCircle className={cn(cls, 'text-muted')} aria-label="Skipped" />;
  return <Circle className={cn(cls, 'text-muted')} aria-label="Not started" />;
}

export type ActionState = 'idle' | 'running' | 'done' | 'failed';

/**
 * Runs a long wizard action and keeps its checklist. `isOk` decides success from the answer (e.g. every step passed);
 * an action that throws, or whose answer isn't ok, ends as "failed" with the checklist showing where.
 */
export function useAction<T = unknown>() {
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [state, setState] = useState<ActionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const run = async (path: string, body: unknown, isOk: (r: T) => boolean = () => true): Promise<T | null> => {
    setState('running');
    setError(null);
    setResult(null);
    setSteps([]);
    try {
      const r = await apiProgress<T>(path, body, setSteps);
      setResult(r);
      setState(isOk(r) ? 'done' : 'failed');
      return r;
    } catch (e) {
      setError((e as Error).message);
      setState('failed');
      return null;
    }
  };
  const reset = () => {
    setState('idle');
    setSteps([]);
    setError(null);
    setResult(null);
  };
  return { steps, state, error, result, run, reset, setState };
}

/**
 * The button for one step of a flow ("1. Apply to database"). Running: spinner. Done: green with a check and what
 * happened ("Database updated"). Failed: "Try again". `current` marks it as the step to do now (filled button).
 */
export function ActionButton({
  state,
  label,
  doneLabel,
  icon,
  onClick,
  disabled,
  current = true,
}: {
  state: ActionState;
  label: string;
  doneLabel: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  current?: boolean;
}) {
  if (state === 'done')
    return (
      <Button variant="success" icon={<Check className="size-4" strokeWidth={3} />} onClick={onClick} title="Run it again">
        {doneLabel}
      </Button>
    );
  return (
    <Button variant={current && !disabled ? 'primary' : 'secondary'} icon={state === 'failed' ? <RotateCcw className="size-4" /> : icon} loading={state === 'running'} disabled={disabled} onClick={onClick}>
      {state === 'failed' ? `${label}: try again` : label}
    </Button>
  );
}

/** "Next: …" after a step succeeds, so it's always clear what to do now. */
export function NextStep({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-[13px] font-medium text-accent">
      <ArrowRight className="size-4 shrink-0" /> <span>Next: {children}</span>
    </p>
  );
}
