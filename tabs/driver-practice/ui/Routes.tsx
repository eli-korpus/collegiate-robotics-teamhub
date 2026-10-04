import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Gamepad2, Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import {
  Button,
  CHART_COLORS,
  Card,
  CardHeader,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  FieldEditor,
  FormRenderer,
  IconButton,
  Input,
  LineChart,
  Select,
  Spinner,
  Textarea,
  emptyValues,
  formatDate,
  summarizeField,
  toDateInput,
  toast,
  type FieldDef,
  type FormValues,
} from '@teamhub/ui';
import {
  canWith,
  friendlyError,
  ModuleHeader,
  ModulePurpose,
  PersonPicker,
  Slot,
  TeamScopePicker,
  useCan,
  useCreateShortcut,
  useMe,
  useNewParam,
  usePeople,
  useRows,
  useSeason,
  useSupabase,
  useTeamScope,
} from '@teamhub/sdk';

export interface DrvRun {
  id: string;
  team_id: string | null;
  date: string;
  driver: string | null;
  operator: string | null;
  kind: string;
  score: number | null;
  auto_score: number | null;
  metrics: FormValues;
  notes: string | null;
  season: string;
  created_by: string | null;
}
const KINDS = [
  { v: 'full', l: 'Full match' },
  { v: 'auto', l: 'Autonomous only' },
  { v: 'teleop', l: 'Driver-controlled only' },
  { v: 'drill', l: 'Drill' },
];

function useFields() {
  const sb = useSupabase();
  return useQuery({
    queryKey: ['driver-practice', 'fields'],
    queryFn: async () => ((await sb.from('drv_fields').select('fields').eq('id', 1).maybeSingle()).data?.fields ?? []) as FieldDef[],
  });
}

export default function DriverPracticeRoutes() {
  const season = useSeason();
  const runs = useRows<DrvRun>(['driver-practice', 'runs', season], (sb) => sb.from('drv_runs').select('*').eq('season', season).order('date'));
  const fields = useFields();
  const people = usePeople();
  const scope = useTeamScope();
  const me = useMe();
  const sb = useSupabase();
  const qc = useQueryClient();
  const canLog = useCan('driver-practice.log');
  const canFields = useCan('driver-practice.manage_fields');
  const [logging, setLogging] = useNewParam();
  const [editingRun, setEditingRun] = useState<DrvRun | null>(null);
  const [editFields, setEditFields] = useState(false);
  const [kind, setKind] = useState('full');
  useCreateShortcut(() => setLogging(true), canLog);
  const list = (runs.data ?? []).filter((r) => (!scope || !r.team_id || r.team_id === scope) && (!kind || r.kind === kind));
  const name = (id: string | null) => (id ? people.data?.get(id)?.name.split(' ')[0] ?? '?' : '–');
  const pairs = useMemo(() => {
    const m = new Map<string, DrvRun[]>();
    for (const r of list) {
      const k = `${r.driver ?? ''}|${r.operator ?? ''}`;
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()].map(([k, rs]) => ({ k, label: `${name(rs[0].driver)} + ${name(rs[0].operator)}`, rs }));
     
  }, [list, people.data]);
  const dates = [...new Set(list.map((r) => r.date))].sort();
  const series = pairs.slice(0, 6).map((p, i) => ({
    label: p.label,
    color: CHART_COLORS[i],
    values: dates.map((d) => {
      const s = p.rs.filter((r) => r.date === d && r.score != null).map((r) => r.score!);
      return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
    }),
  }));
  const avg = (xs: (number | null)[]) => {
    const n = xs.filter((x): x is number => x != null);
    return n.length ? n.reduce((a, b) => a + b, 0) / n.length : null;
  };
  return (
    <div>
      <ModuleHeader
        moduleId="driver-practice"
        actions={
          <>
            {canFields && (
              <Button size="sm" variant="ghost" icon={<Settings2 className="size-4" />} onClick={() => setEditFields(true)}>
                Metrics
              </Button>
            )}
            {canLog && (
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setLogging(true)}>
                Log a run
              </Button>
            )}
          </>
        }
      >
        <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-52" aria-label="Run type">
          <option value="">All run types</option>
          {KINDS.map((k) => (
            <option key={k.v} value={k.v}>
              {k.l}
            </option>
          ))}
        </Select>
      </ModuleHeader>
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6">
        {runs.isLoading ? (
          <Spinner />
        ) : !list.length ? (
          <EmptyState icon={<Gamepad2 />} title="No practice runs this season" body={<ModulePurpose moduleId="driver-practice" compact className="mt-2 text-left" />} action={canLog && <Button onClick={() => setLogging(true)}>Log the first run</Button>} />
        ) : (
          <>
            <Card>
              <CardHeader title="Score over time" subtitle="Average per day, by driver pair" />
              <div className="px-4 pb-4">
                <LineChart series={series} xLabels={dates.map((d) => formatDate(d))} />
              </div>
            </Card>
            <DataTable
              rows={pairs}
              keyOf={(p) => p.k}
              columns={[
                { id: 'pair', header: 'Driver + operator', cell: (p) => <span className="font-medium">{p.label}</span> },
                { id: 'n', header: 'Runs', align: 'right', sort: (p) => p.rs.length, cell: (p) => p.rs.length },
                { id: 'avg', header: 'Avg score', align: 'right', sort: (p) => avg(p.rs.map((r) => r.score)) ?? -1, cell: (p) => avg(p.rs.map((r) => r.score))?.toFixed(1) ?? '–' },
                { id: 'best', header: 'Best', align: 'right', sort: (p) => Math.max(-1, ...p.rs.map((r) => r.score ?? -1)), cell: (p) => Math.max(...p.rs.map((r) => r.score ?? -Infinity)).toString().replace('-Infinity', '–') },
                { id: 'auto', header: 'Avg auto', align: 'right', cell: (p) => avg(p.rs.map((r) => r.auto_score))?.toFixed(1) ?? '–' },
                ...(fields.data ?? []).slice(0, 4).map((f) => ({ id: f.id, header: f.label, align: 'right' as const, cell: (p: (typeof pairs)[number]) => summarizeField(f, p.rs.map((r) => r.metrics?.[f.id] ?? null)) })),
              ]}
            />
            <Card>
              <CardHeader title="Recent runs" />
              <ul className="divide-y divide-border px-4 pb-2 text-[13px]">
                {[...list].reverse().slice(0, 15).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2">
                    <span className="w-20 text-muted">{formatDate(r.date)}</span>
                    <span className="flex-1">
                      {name(r.driver)} + {name(r.operator)} · {KINDS.find((k) => k.v === r.kind)?.l ?? r.kind}
                      {r.notes && <span className="block truncate text-[12px] text-muted">{r.notes}</span>}
                    </span>
                    <span className="tabular font-semibold">{r.score ?? '–'}</span>
                    <Slot name="driver-practice.run.actions" props={{ run: r }} />
                    {(r.created_by === me.id || canWith(me, 'driver-practice.manage_fields', r.team_id)) && (
                      <IconButton label="Edit run" size="sm" onClick={() => setEditingRun(r)}>
                        <Pencil className="size-3.5" />
                      </IconButton>
                    )}
                    {(r.created_by === me.id || canWith(me, 'driver-practice.manage_fields', r.team_id)) && (
                      <IconButton
                        label="Delete run"
                        size="sm"
                        onClick={async () => {
                          const { error } = await sb.from('drv_runs').delete().eq('id', r.id);
                          if (error) toast.error(friendlyError(error));
                          qc.invalidateQueries({ queryKey: ['driver-practice'] });
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </IconButton>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>
      {logging && <LogDialog fields={fields.data ?? []} onClose={() => setLogging(false)} />}
      {editingRun && <LogDialog run={editingRun} fields={fields.data ?? []} onClose={() => setEditingRun(null)} />}
      {editFields && <FieldsDialog fields={fields.data ?? []} onClose={() => setEditFields(false)} />}
    </div>
  );
}

/** Log a new run, or fix one (pass `run`). */
function LogDialog({ fields, onClose, run }: { fields: FieldDef[]; onClose: () => void; run?: DrvRun }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const scope = useTeamScope();
  const [v, setV] = useState(
    run
      ? { date: run.date, driver: run.driver ? [run.driver] : [], operator: run.operator ? [run.operator] : [], kind: run.kind, score: run.score == null ? '' : String(run.score), auto_score: run.auto_score == null ? '' : String(run.auto_score), notes: run.notes ?? '', team_id: run.team_id }
      : { date: toDateInput(new Date()), driver: [me.id], operator: [] as string[], kind: 'full', score: '', auto_score: '', notes: '', team_id: scope },
  );
  const [metrics, setMetrics] = useState<FormValues>(run ? { ...emptyValues(fields), ...run.metrics } : emptyValues(fields));
  return (
    <Dialog
      open
      onOpenChange={(x) => !x && onClose()}
      title={run ? 'Edit practice run' : 'Log a practice run'}
      size="lg"
      footer={
        <Button
          variant="primary"
          onClick={async () => {
            const body = {
              date: v.date,
              driver: v.driver[0] ?? null,
              operator: v.operator[0] ?? null,
              kind: v.kind,
              score: v.score === '' ? null : Number(v.score),
              auto_score: v.auto_score === '' ? null : Number(v.auto_score),
              notes: v.notes || null,
              metrics,
              team_id: v.team_id,
            };
            const { error } = run ? await sb.from('drv_runs').update(body).eq('id', run.id) : await sb.from('drv_runs').insert({ ...body, created_by: me.id });
            if (error) return toast.error(friendlyError(error));
            qc.invalidateQueries({ queryKey: ['driver-practice'] });
            onClose();
          }}
        >
          {run ? 'Save changes' : 'Save run'}
        </Button>
      }
    >
      <div className="space-y-4">
        <TeamScopePicker value={v.team_id} onChange={(team_id) => setV({ ...v, team_id })} perm="driver-practice.log" label="Team" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Driver">{() => <PersonPicker value={v.driver} onChange={(driver) => setV({ ...v, driver })} />}</Field>
          <Field label="Operator" optional>{() => <PersonPicker value={v.operator} onChange={(operator) => setV({ ...v, operator })} />}</Field>
          <Field label="Date">{(id) => <Input id={id} type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />}</Field>
          <Field label="Run type">
            {(id) => (
              <Select id={id} value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
                {KINDS.map((k) => (
                  <option key={k.v} value={k.v}>
                    {k.l}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Total score" optional>{(id) => <Input id={id} type="number" inputMode="numeric" value={v.score} onChange={(e) => setV({ ...v, score: e.target.value })} />}</Field>
          <Field label="Auto score" optional>{(id) => <Input id={id} type="number" inputMode="numeric" value={v.auto_score} onChange={(e) => setV({ ...v, auto_score: e.target.value })} />}</Field>
        </div>
        {fields.length > 0 && <FormRenderer fields={fields} values={metrics} onChange={setMetrics} />}
        <Field label="Notes" optional>{(id) => <Textarea id={id} rows={2} maxLength={1000} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />}</Field>
      </div>
    </Dialog>
  );
}

function FieldsDialog({ fields, onClose }: { fields: FieldDef[]; onClose: () => void }) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const [f, setF] = useState(fields);
  return (
    <Dialog
      open
      onOpenChange={(x) => !x && onClose()}
      title="What to measure"
      description="Add the metrics that matter for this season's game (e.g. cycles, pieces scored, endgame success). Nothing is built in."
      size="lg"
      footer={
        <Button
          variant="primary"
          onClick={async () => {
            const { error } = await sb.from('drv_fields').update({ fields: f.filter((x) => x.label.trim()) }).eq('id', 1);
            if (error) return toast.error(friendlyError(error));
            qc.invalidateQueries({ queryKey: ['driver-practice'] });
            onClose();
          }}
        >
          Save metrics
        </Button>
      }
    >
      <FieldEditor fields={f} onChange={setF} types={['counter', 'number', 'checkbox', 'select', 'rating', 'timer']} sections={false} />
    </Dialog>
  );
}
