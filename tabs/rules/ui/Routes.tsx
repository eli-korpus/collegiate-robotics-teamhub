import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BookMarked, CircleHelp, ExternalLink, Plus, Scale, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Dialog, EmptyState, Field, IconButton, Input, Markdown, RelativeTime, SearchInput, Segmented, Select, Spinner, Textarea, matches, toast, useConfirm } from '@teamhub/ui';
import { canWith, friendlyError, ModuleHeader, ModulePurpose, PersonName, TeamChatLink, useCan, useCreateShortcut, useMe, useNewParam, useRows, useSeason, useSupabase } from '@teamhub/sdk';

interface RuleItem {
  id: string;
  kind: 'question' | 'reminder';
  title: string;
  body: string | null;
  answer: string | null;
  rule_ref: string | null;
  source_url: string | null;
  season: string;
  created_by: string | null;
  answered_by: string | null;
  created_at: string;
}

export default function RulesRoutes() {
  const current = useSeason();
  const [season, setSeason] = useState(current);
  const items = useRows<RuleItem>(['rules', 'items'], (sb) => sb.from('rule_items').select('*').order('created_at', { ascending: false }));
  const canPost = useCan('rules.post');
  const [tab, setTab] = useState<'question' | 'reminder'>('question');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useNewParam();
  useCreateShortcut(() => setCreating(true), canPost);
  const seasons = [...new Set([current, ...(items.data ?? []).map((i) => i.season)])];
  const list = (items.data ?? []).filter((i) => i.kind === tab && i.season === season && (!q || matches(`${i.title} ${i.body ?? ''} ${i.answer ?? ''} ${i.rule_ref ?? ''}`, q)));
  const open = list.filter((i) => !i.answer);
  const answered = list.filter((i) => i.answer);
  return (
    <div>
      <ModuleHeader moduleId="rules" actions={canPost && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>{tab === 'question' ? 'Ask a question' : 'Add a reminder'}</Button>}>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented size="sm" value={tab} onChange={setTab} options={[{ value: 'question', label: 'Questions', icon: <CircleHelp className="size-3.5" /> }, { value: 'reminder', label: 'Reminders', icon: <BookMarked className="size-3.5" /> }]} />
          {seasons.length > 1 && (
            <Select value={season} onChange={(e) => setSeason(e.target.value)} className="w-32" aria-label="Season">
              {seasons.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </div>
      </ModuleHeader>
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 sm:px-6">
        <SearchInput value={q} onChange={setQ} placeholder="Search rules, answers, rule numbers…" />
        {items.isLoading ? (
          <Spinner />
        ) : !list.length ? (
          <EmptyState icon={<Scale />} title={tab === 'question' ? 'No rule questions yet' : 'No reminders yet'} body={<ModulePurpose moduleId="rules" compact className="mt-2 text-left" />} />
        ) : (
          <>
            {tab === 'question' && open.length > 0 && <h2 className="text-[12px] font-semibold uppercase tracking-wider text-warning">Waiting for an answer</h2>}
            {[...open, ...answered].map((i) => (
              <RuleCard key={i.id} item={i} />
            ))}
          </>
        )}
        <TeamChatLink prefix="Quick discussion?" />
      </div>
      {creating && <ItemDialog kind={tab} onClose={() => setCreating(false)} />}
    </div>
  );
}

function RuleCard({ item: i }: { item: RuleItem }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState(i.answer ?? '');
  const [source, setSource] = useState(i.source_url ?? '');
  const canAnswer = canWith(me, 'rules.answer');
  const canDelete = canAnswer || (i.created_by === me.id && !i.answer);
  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {i.rule_ref && <Badge className="mr-1.5">{i.rule_ref}</Badge>}
            {i.title}
          </p>
          <p className="text-[12px] text-muted">
            <PersonName id={i.created_by} /> · <RelativeTime date={i.created_at} />
          </p>
        </div>
        {i.kind === 'question' && (i.answer ? <Badge tone="success">Answered</Badge> : <Badge tone="warning">Open</Badge>)}
        {canDelete && (
          <IconButton
            label="Delete"
            size="sm"
            onClick={async () => {
              if (!(await confirm({ title: 'Delete this entry?', danger: true, confirmLabel: 'Delete' }))) return;
              const { error } = await sb.from('rule_items').delete().eq('id', i.id);
              if (error) toast.error(friendlyError(error));
              qc.invalidateQueries({ queryKey: ['rules'] });
            }}
          >
            <Trash2 className="size-4" />
          </IconButton>
        )}
      </div>
      {i.body && <Markdown source={i.body} className="text-[13.5px]" />}
      {i.answer && (
        <div className="rounded-md border-l-4 border-success bg-success-soft/40 p-3">
          <Markdown source={i.answer} className="text-[13.5px]" />
          <p className="mt-1 text-[12px] text-muted">
            {i.answered_by && (
              <>
                Answered by <PersonName id={i.answered_by} />
              </>
            )}
            {i.source_url && (
              <a href={i.source_url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-accent hover:underline">
                Source <ExternalLink className="size-3" />
              </a>
            )}
          </p>
        </div>
      )}
      {i.kind === 'question' && canAnswer && !answering && (
        <Button size="sm" variant="ghost" onClick={() => setAnswering(true)}>
          {i.answer ? 'Edit answer' : 'Answer'}
        </Button>
      )}
      {answering && (
        <div className="space-y-2">
          <Textarea rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="The official answer (from the Q&A forum or manual)" maxLength={4000} />
          <Input type="url" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Link to the official Q&A post or manual section" />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={async () => {
                if (source && !/^https?:\/\//.test(source)) return toast.error('Links must start with https://');
                const { error } = await sb.from('rule_items').update({ answer: answer.trim() || null, source_url: source || null, answered_by: me.id }).eq('id', i.id);
                if (error) return toast.error(friendlyError(error));
                setAnswering(false);
                qc.invalidateQueries({ queryKey: ['rules'] });
              }}
            >
              Save answer
            </Button>
            <Button size="sm" onClick={() => setAnswering(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function ItemDialog({ kind, onClose }: { kind: 'question' | 'reminder'; onClose: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const [v, setV] = useState({ title: '', body: '', rule_ref: '', source_url: '' });
  return (
    <Dialog
      open
      onOpenChange={(x) => !x && onClose()}
      title={kind === 'question' ? 'Ask a rule question' : 'Add a rule reminder'}
      footer={
        <Button
          variant="primary"
          onClick={async () => {
            if (!v.title.trim()) return toast.error(kind === 'question' ? 'Write the question' : 'Write the reminder');
            if (v.source_url && !/^https?:\/\//.test(v.source_url)) return toast.error('Links must start with https://');
            const { error } = await sb.from('rule_items').insert({ kind, title: v.title.trim(), body: v.body || null, rule_ref: v.rule_ref || null, source_url: v.source_url || null, created_by: me.id });
            if (error) return toast.error(friendlyError(error));
            qc.invalidateQueries({ queryKey: ['rules'] });
            onClose();
          }}
        >
          Save
        </Button>
      }
    >
      <div className="space-y-3">
        <ModulePurpose moduleId="rules" compact />
        <Field label={kind === 'question' ? 'Question' : 'Rule to remember'} required>{(id) => <Input id={id} autoFocus maxLength={200} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />}</Field>
        <Field label="Rule number" optional hint="e.g. G12, R304">{(id) => <Input id={id} maxLength={40} value={v.rule_ref} onChange={(e) => setV({ ...v, rule_ref: e.target.value })} />}</Field>
        <Field label="Details" optional>{(id) => <Textarea id={id} rows={3} maxLength={4000} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} />}</Field>
        <Field label="Source link" optional>{(id) => <Input id={id} type="url" value={v.source_url} onChange={(e) => setV({ ...v, source_url: e.target.value })} />}</Field>
      </div>
    </Dialog>
  );
}
