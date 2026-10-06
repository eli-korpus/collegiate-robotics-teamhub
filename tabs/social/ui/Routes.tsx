import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, Megaphone, Plus, Send, Trash2 } from 'lucide-react';
import {
  Banner,
  Button,
  Calendar,
  Dialog,
  EmptyState,
  Field,
  Input,
  Kanban,
  KanbanCard,
  Segmented,
  Spinner,
  StatusPill,
  Textarea,
  cn,
  formatDate,
  formatTime,
  toDateTimeInput,
  toast,
  useConfirm,
  type CalendarView,
  safeHref,
} from '@teamhub/ui';
import {
  canWith,
  EntityLink,
  friendlyError,
  isUrl,
  ModuleHeader,
  ModulePurpose,
  PersonName,
  TeamBadge,
  TeamScopePicker,
  useCan,
  useCreateShortcut,
  useLocalStorage,
  useMe,
  useModuleSettings,
  useNewParam,
  useSelectedParam,
  useSupabase,
  useTeamScope,
  useToolLink,
} from '@teamhub/sdk';
import { firstLine, STAGES, usePosts, type Post, type Stage } from './data';

const PLATFORM_COLORS: Record<string, string> = { Instagram: '#C13584', TikTok: '#111827', YouTube: '#DC2626', Facebook: '#1D4ED8', LinkedIn: '#0A66C2' };

export default function SocialRoutes() {
  const posts = usePosts();
  const scope = useTeamScope();
  const me = useMe();
  const sb = useSupabase();
  const qc = useQueryClient();
  const canDraft = useCan('social.draft');
  const onePlatform = useModuleSettings<{ platforms: string[] }>('social').platforms.length === 1;
  const [view, setView] = useLocalStorage<'board' | 'calendar'>('teamhub-social-view', 'board');
  const [calView, setCalView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState(new Date());
  const [creating, setCreating, params] = useNewParam();
  const [selected, setSelected] = useSelectedParam();
  useCreateShortcut(() => setCreating(true), canDraft);
  const list = (posts.data ?? []).filter((p) => !scope || !p.team_id || p.team_id === scope);
  const current = list.find((p) => p.id === selected) ?? null;
  const move = async (p: Post, to: string) => {
    if (p.status === to) return;
    const { error } = await sb.from('soc_posts').update({ status: to }).eq('id', p.id);
    if (error) return toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ['social'] });
  };
  return (
    <div className="flex h-full flex-col">
      <ModuleHeader moduleId="social" actions={canDraft && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>New post idea</Button>}>
        <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'board', label: 'Board' }, { value: 'calendar', label: 'Calendar' }]} />
      </ModuleHeader>
      {posts.isLoading ? (
        <Spinner className="m-8" />
      ) : !list.length ? (
        <EmptyState icon={<Megaphone />} title="No posts planned" body={<ModulePurpose moduleId="social" compact className="mt-2 text-left" />} />
      ) : view === 'board' ? (
        <div className="min-h-0 flex-1">
          <Kanban
            columns={STAGES.map((s) => ({ id: s.id, title: s.label, items: list.filter((p) => p.status === s.id) }))}
            keyOf={(p) => p.id}
            canDrag={(p) => canWith(me, 'social.draft', p.team_id) || canWith(me, 'social.approve', p.team_id)}
            onMove={(p, to) => move(p, to)}
            render={(p) => (
              <KanbanCard onClick={() => setSelected(p.id)} accent={PLATFORM_COLORS[p.platforms[0]]}>
                <p className="line-clamp-2 text-[13px] font-medium">{firstLine(p.caption)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted">
                  {!onePlatform &&
                    p.platforms.map((x) => (
                    <span key={x} className="rounded bg-bg-subtle px-1.5">
                      {x}
                    </span>
                  ))}
                  {p.scheduled_for && <span>{formatDate(p.scheduled_for, { month: 'short', day: 'numeric' })}</span>}
                  <TeamBadge teamId={p.team_id} />
                </div>
              </KanbanCard>
            )}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 p-4 sm:px-6">
          <Calendar
            view={calView}
            onViewChange={setCalView}
            cursor={cursor}
            onCursorChange={setCursor}
            items={list
              .filter((p) => p.scheduled_for)
              .map((p) => ({ id: p.id, title: firstLine(p.caption), start: new Date(p.scheduled_for!), color: PLATFORM_COLORS[p.platforms[0]] ?? '#64748B', meta: p.platforms.join(', '), cancelled: false }))}
            onItemClick={(it) => setSelected(it.id)}
          />
        </div>
      )}
      {(creating || current) && <PostDialog post={creating ? null : current} draft={params.get('media')} onClose={() => (creating ? setCreating(false) : setSelected(null))} />}
    </div>
  );
}

function PostDialog({ post, draft, onClose }: { post: Post | null; draft: string | null; onClose: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const scope = useTeamScope();
  const { platforms } = useModuleSettings<{ platforms: string[] }>('social');
  // One platform: every post goes there, so don't ask (posts saved earlier keep what they had).
  const only = platforms.length === 1 ? platforms[0] : null;
  const social = useToolLink('social');
  const team = post ? post.team_id : scope;
  const approver = canWith(me, 'social.approve', team);
  const marker = canWith(me, 'social.mark_posted', team);
  const canEdit = !post || canWith(me, 'social.draft', team) || approver;
  const [v, setV] = useState({
    platforms: post?.platforms ?? (only ? [only] : []),
    caption: post?.caption ?? '',
    media_ref: post?.media_ref ?? draft ?? '',
    scheduled_for: post?.scheduled_for ? toDateTimeInput(new Date(post.scheduled_for)) : '',
    posted_url: post?.posted_url ?? '',
    team_id: team,
  });
  const save = async (status?: Stage) => {
    if (!v.caption.trim() && (status ?? post?.status ?? 'idea') !== 'idea') return toast.error('Write the caption first');
    if (v.posted_url && !/^https?:\/\//i.test(v.posted_url)) return toast.error('Post link must start with https://');
    const body = {
      platforms: only && !v.platforms.length ? [only] : v.platforms,
      caption: v.caption,
      media_ref: v.media_ref.trim() || null,
      scheduled_for: v.scheduled_for ? new Date(v.scheduled_for).toISOString() : null,
      posted_url: v.posted_url.trim() || null,
      team_id: v.team_id,
      ...(status ? { status } : {}),
    };
    const { error } = post ? await sb.from('soc_posts').update(body).eq('id', post.id) : await sb.from('soc_posts').insert({ ...body, status: status ?? 'idea', created_by: me.id });
    if (error) return toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ['social'] });
    toast.success(status === 'approval' ? 'Sent for approval' : status === 'scheduled' ? 'Approved and scheduled' : status === 'posted' ? 'Marked as posted' : 'Saved');
    onClose();
  };
  const status = post?.status ?? 'idea';
  const approvedEdit = post?.status === 'scheduled' && !approver && v.caption !== post.caption;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={post ? firstLine(post.caption) : 'New post idea'}
      description={post ? <>Suggested by <PersonName id={post.created_by} />{post.approved_by && <> · approved by <PersonName id={post.approved_by} /></>}</> : undefined}
      size="lg"
      footer={
        <>
          {post && (post.created_by === me.id || approver) && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (!(await confirm({ title: 'Delete this post?', danger: true, confirmLabel: 'Delete' }))) return;
                await sb.from('soc_posts').delete().eq('id', post.id);
                qc.invalidateQueries({ queryKey: ['social'] });
                onClose();
              }}
            >
              Delete
            </Button>
          )}
          {canEdit && <Button onClick={() => save()}>Save</Button>}
          {canEdit && ['idea', 'draft'].includes(status) && !approver && (
            <Button variant="primary" icon={<Send className="size-4" />} onClick={() => save('approval')}>
              Ask for approval
            </Button>
          )}
          {approver && ['idea', 'draft', 'approval'].includes(status) && (
            <Button variant="primary" icon={<Check className="size-4" />} onClick={() => save('scheduled')}>
              Approve & schedule
            </Button>
          )}
          {marker && status === 'scheduled' && (
            <Button variant="primary" onClick={() => save('posted')}>
              Mark posted
            </Button>
          )}
        </>
      }
    >
      <fieldset disabled={!canEdit} className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={STAGES.find((s) => s.id === status)!.label} tone={status === 'approval' ? 'warning' : status === 'scheduled' ? 'info' : status === 'posted' ? 'success' : 'neutral'} />
          <span className="text-[12px] text-faint">TeamHub never posts for you: copy the caption and post it yourself.</span>
        </div>
        {approvedEdit && <Banner tone="warning">Changing the caption sends this post back for approval.</Banner>}
        {!(only && v.platforms.every((x) => x === only)) && (
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium">Where</legend>
          <div className="flex flex-wrap gap-1.5">
            {[...new Set([...platforms, ...v.platforms])].map((p) => {
              const on = v.platforms.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setV({ ...v, platforms: on ? v.platforms.filter((x) => x !== p) : [...v.platforms, p] })}
                  className={cn('h-7 rounded-full border px-3 text-[12.5px]', on ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-border hover:border-border-strong')}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </fieldset>
        )}
        <Field label="Caption" hint={`${v.caption.length} characters. Optional for an idea; needed before it goes for approval.`}>
          {(id) => (
            <div className="relative">
              <Textarea id={id} rows={5} maxLength={5000} value={v.caption} onChange={(e) => setV({ ...v, caption: e.target.value })} placeholder="Idea: show the intake prototype eating 3 samples in a row" />
              {v.caption && (
                <button
                  type="button"
                  className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-surface px-1.5 text-[12px] text-muted hover:text-fg"
                  onClick={() => navigator.clipboard.writeText(v.caption).then(() => toast.success('Caption copied'))}
                >
                  <Copy className="size-3.5" /> Copy
                </button>
              )}
            </div>
          )}
        </Field>
        <Field label="Photo or video" optional hint="A Drive/Canva link, or a photo link from the Media Gallery">
          {(id) => (
            <>
              <Input id={id} value={v.media_ref} onChange={(e) => setV({ ...v, media_ref: e.target.value })} placeholder="https://…" />
              {v.media_ref && !isUrl(v.media_ref) && (
                <p className="mt-1 text-[12.5px]">
                  <EntityLink refStr={v.media_ref} />
                </p>
              )}
              {v.media_ref && isUrl(v.media_ref) && (
                <a href={safeHref(v.media_ref)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[12.5px] text-accent hover:underline">
                  Open <ExternalLink className="size-3" />
                </a>
              )}
            </>
          )}
        </Field>
        <Field label="When to post" optional>{(id) => <Input id={id} type="datetime-local" value={v.scheduled_for} onChange={(e) => setV({ ...v, scheduled_for: e.target.value })} />}</Field>
        {(status === 'scheduled' || status === 'posted') && (
          <Field label="Link to the live post" optional>{(id) => <Input id={id} type="url" value={v.posted_url} onChange={(e) => setV({ ...v, posted_url: e.target.value })} placeholder="https://instagram.com/p/…" />}</Field>
        )}
        {post?.scheduled_for && status === 'scheduled' && (
          <p className="text-[12.5px] text-muted">
            Scheduled for {formatDate(post.scheduled_for, { weekday: 'long', month: 'long', day: 'numeric' })} at {formatTime(new Date(post.scheduled_for))}
            {social && (
              <>
                {' '}
                ·{' '}
                <a href={safeHref(social.url)} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  Open {social.label} <ExternalLink className="inline size-3" aria-hidden />
                </a>
              </>
            )}
          </p>
        )}
        <TeamScopePicker value={v.team_id} onChange={(t) => setV({ ...v, team_id: t })} perm="social.draft" />
      </fieldset>
    </Dialog>
  );
}
