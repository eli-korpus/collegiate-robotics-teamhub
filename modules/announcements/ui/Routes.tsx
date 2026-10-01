import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Image as ImageIcon, Megaphone, Pencil, Pin, Trash2, X } from 'lucide-react';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  DetailPane,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  ListRow,
  Markdown,
  RelativeTime,
  SmartGroupList,
  SplitView,
  Switch,
  Textarea,
  markdownExcerpt,
  sameDay,
  toast,
  useConfirm,
  daysBetween,
  type ProcessedFile,
} from '@teamhub/ui';
import {
  canWith,
  friendlyError,
  ModuleHeader,
  ModulePurpose,
  Person,
  PersonName,
  ScopeVisibility,
  TeamBadge,
  TeamChatLink,
  TeamScopePicker,
  Upload,
  storagePath,
  uploadFile,
  useActivePeople,
  useCan,
  useCreateShortcut,
  useLastSeen,
  useListNav,
  useMe,
  useNewParam,
  useRows,
  useSelectedParam,
  useSignedUrls,
  useSupabase,
  useTeamScope,
} from '@teamhub/sdk';

export interface Post {
  id: string;
  team_id: string | null;
  title: string;
  body: string;
  image_path: string | null;
  pinned: boolean;
  require_ack: boolean;
  created_by: string | null;
  created_at: string;
  edited_at: string | null;
}

export function usePosts() {
  return useRows<Post>(['announcements', 'posts'], (sb) => sb.from('ann_posts').select('*').order('created_at', { ascending: false }).limit(200));
}

export function useMyAcks() {
  const me = useMe();
  return useRows<{ post_id: string }>(['announcements', 'my-acks'], (sb) => sb.from('ann_acks').select('post_id').eq('user_id', me.id));
}

export default function AnnouncementsRoutes() {
  const posts = usePosts();
  const acks = useMyAcks();
  const scope = useTeamScope();
  const canPost = useCan('announcements.post');
  const [selected, setSelected] = useSelectedParam();
  const [composing, setComposing] = useNewParam();
  const [editing, setEditing] = useState<Post | null>(null);
  const [lastSeen, markSeen] = useLastSeen('announcements');
  const [seenAtOpen] = useState(lastSeen);
  const me = useMe();
  useEffect(() => {
    markSeen();
    // mark as seen when leaving too, so posts read now don't count as unread next time
    return markSeen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useCreateShortcut(() => setComposing(true), canPost);

  const list = (posts.data ?? []).filter((p) => !scope || !p.team_id || p.team_id === scope);
  const acked = new Set((acks.data ?? []).map((a) => a.post_id));
  const now = new Date();
  const groups = [
    { id: 'pinned', title: 'Pinned', items: list.filter((p) => p.pinned) },
    { id: 'must', title: 'Must read', tone: 'warning' as const, items: list.filter((p) => !p.pinned && p.require_ack && !acked.has(p.id)) },
    { id: 'today', title: 'Today', items: list.filter((p) => !p.pinned && !(p.require_ack && !acked.has(p.id)) && sameDay(new Date(p.created_at), now)) },
    { id: 'week', title: 'This week', items: list.filter((p) => !p.pinned && !(p.require_ack && !acked.has(p.id)) && !sameDay(new Date(p.created_at), now) && daysBetween(new Date(p.created_at), now) <= 7) },
    { id: 'earlier', title: 'Earlier', items: list.filter((p) => !p.pinned && !(p.require_ack && !acked.has(p.id)) && daysBetween(new Date(p.created_at), now) > 7) },
  ];
  const flat = groups.flatMap((g) => g.items);
  const current = list.find((p) => p.id === selected) ?? null;
  useListNav(flat, current, (p) => setSelected(p.id), (p) => p.id);

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        moduleId="announcements"
        actions={
          canPost && (
            <Button variant="primary" icon={<Megaphone className="size-4" />} onClick={() => setComposing(true)}>
              New announcement
            </Button>
          )
        }
      />
      <div className="min-h-0 flex-1">
        <SplitView
          onCloseDetail={() => setSelected(null)}
          detailTitle={current?.title}
          detail={current ? <PostDetail post={current} acked={acked.has(current.id)} onEdit={() => setEditing(current)} onDeleted={() => setSelected(null)} /> : null}
          list={
            <SmartGroupList
              groups={groups}
              keyOf={(p) => p.id}
              empty={<EmptyState icon={<Megaphone />} title="No announcements yet" body={<ModulePurpose moduleId="announcements" compact className="mt-2 text-left" />} />}
              render={(p) => {
                const unread = new Date(p.created_at).getTime() > seenAtOpen && p.created_by !== me.id;
                return (
                  <ListRow selected={p.id === selected} onClick={() => setSelected(p.id)}>
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${unread ? 'bg-accent' : 'bg-transparent'}`} aria-label={unread ? 'Unread' : undefined} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {p.pinned && <Pin className="size-3.5 shrink-0 text-muted" />}
                        <p className={`truncate text-[13.5px] ${unread ? 'font-semibold' : 'font-medium'}`}>{p.title}</p>
                      </div>
                      <p className="line-clamp-2 text-[12.5px] text-muted">{markdownExcerpt(p.body, 160)}</p>
                      <p className="mt-1 flex items-center gap-2 text-[11.5px] text-faint">
                        <PersonName id={p.created_by} /> · <RelativeTime date={p.created_at} /> <TeamBadge teamId={p.team_id} />
                        {p.require_ack && (acked.has(p.id) ? <span className="text-success">✓ read</span> : <Badge tone="warning">Must read</Badge>)}
                      </p>
                    </div>
                  </ListRow>
                );
              }}
            />
          }
        />
      </div>
      {(composing || editing) && <Composer post={editing} onClose={() => (setComposing(false), setEditing(null))} />}
    </div>
  );
}

function PostDetail({ post, acked, onEdit, onDeleted }: { post: Post; acked: boolean; onEdit: () => void; onDeleted: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const img = useSignedUrls('announcements', [post.image_path]);
  const canManage = (post.created_by === me.id && canWith(me, 'announcements.post', post.team_id)) || canWith(me, 'announcements.delete_any', post.team_id);
  const canSeeAcks = post.created_by === me.id || canWith(me, 'announcements.view_acks', post.team_id);
  const refresh = () => qc.invalidateQueries({ queryKey: ['announcements'] });
  return (
    <DetailPane
      title={post.title}
      onClose={onDeleted}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <Person id={post.created_by} size="sm" /> <RelativeTime date={post.created_at} /> {post.edited_at && <span>(edited)</span>} <TeamBadge teamId={post.team_id} />
        </span>
      }
      actions={
        canManage && (
          <>
            <IconButton label="Edit" size="sm" onClick={onEdit}>
              <Pencil className="size-4" />
            </IconButton>
            <IconButton
              label="Delete"
              size="sm"
              onClick={async () => {
                if (!(await confirm({ title: 'Delete this announcement?', danger: true, confirmLabel: 'Delete' }))) return;
                const { error } = await sb.from('ann_posts').delete().eq('id', post.id);
                if (error) return toast.error(friendlyError(error));
                refresh();
                onDeleted();
              }}
            >
              <Trash2 className="size-4" />
            </IconButton>
          </>
        )
      }
    >
      {post.image_path && img.data?.get(post.image_path) && <img src={img.data.get(post.image_path) ?? undefined} alt="" className="max-h-96 w-full rounded-lg object-contain" />}
      <Markdown source={post.body} />
      {post.require_ack &&
        (acked ? (
          <p className="flex items-center gap-1.5 text-[13px] text-success">
            <CheckCircle2 className="size-4" /> You marked this as read
          </p>
        ) : (
          <Button
            variant="primary"
            icon={<CheckCircle2 className="size-4" />}
            onClick={async () => {
              const { error } = await sb.from('ann_acks').insert({ post_id: post.id, user_id: me.id });
              if (error) return toast.error(friendlyError(error));
              refresh();
            }}
          >
            I've read this
          </Button>
        ))}
      {post.require_ack && canSeeAcks && <AckList post={post} />}
      <TeamChatLink className="border-t border-border pt-3" />
    </DetailPane>
  );
}

function AckList({ post }: { post: Post }) {
  const sb = useSupabase();
  const people = useActivePeople(post.team_id);
  const acks = useQuery({
    queryKey: ['announcements', 'acks', post.id],
    queryFn: async () => {
      const { data } = await sb.from('ann_acks').select('user_id').eq('post_id', post.id);
      return new Set((data ?? []).map((a) => a.user_id as string));
    },
  });
  const missing = people.filter((p) => !acks.data?.has(p.id));
  return (
    <div className="rounded-md border border-border p-3">
      <p className="mb-2 text-[12.5px] font-medium">
        {acks.data?.size ?? 0} of {people.length} have read it
      </p>
      {missing.length > 0 && (
        <>
          <p className="mb-1 text-[12px] text-muted">Not yet:</p>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-bg-subtle py-0.5 pl-0.5 pr-2 text-[12px]">
                <Avatar name={p.name} src={p.avatarUrl} size={18} /> {p.name}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Composer({ post, onClose }: { post: Post | null; onClose: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const scope = useTeamScope();
  const [title, setTitle] = useState(post?.title ?? '');
  const [body, setBody] = useState(post?.body ?? '');
  const [teamId, setTeamId] = useState<string | null>(post ? post.team_id : scope);
  const [pinned, setPinned] = useState(post?.pinned ?? false);
  const [requireAck, setRequireAck] = useState(post?.require_ack ?? false);
  const [image, setImage] = useState<ProcessedFile | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => (image ? URL.createObjectURL(image.blob) : null), [image]);

  const save = async () => {
    if (!title.trim()) return toast.error('Add a title');
    setBusy(true);
    try {
      const id = post?.id ?? crypto.randomUUID();
      let image_path = removeImage ? null : (post?.image_path ?? null);
      if (image) image_path = await uploadFile('announcements', storagePath(teamId, id, image.name), image);
      const row = { title: title.trim(), body: body.trim(), team_id: teamId, pinned, require_ack: requireAck, image_path };
      const res = post ? await sb.from('ann_posts').update({ ...row, edited_at: new Date().toISOString() }).eq('id', id) : await sb.from('ann_posts').insert({ ...row, id, created_by: me.id });
      if (res.error) throw res.error;
      if (post?.image_path && post.image_path !== image_path) await sb.storage.from('announcements').remove([post.image_path]);
      qc.invalidateQueries({ queryKey: ['announcements'] });
      toast.success(post ? 'Announcement updated' : 'Announcement posted');
      onClose();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={post ? 'Edit announcement' : 'New announcement'}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={busy}>
            {post ? 'Save' : 'Post'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!post && <ModulePurpose moduleId="announcements" compact />}
        <TeamScopePicker value={teamId} onChange={setTeamId} perm="announcements.post" label="Send to" />
        <Field label="Title">{(id) => <Input id={id} autoFocus maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <Field label="Message" hint="Formatting: **bold**, *italic*, - lists, [links](https://…)">
          {(id) => <Textarea id={id} rows={7} maxLength={8000} value={body} onChange={(e) => setBody(e.target.value)} />}
        </Field>
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-[13px] font-medium">
            <ImageIcon className="size-4" /> Image <span className="font-normal text-faint">(optional)</span>
          </p>
          {preview || (post?.image_path && !removeImage) ? (
            <div className="flex items-center gap-3">
              {preview ? <img src={preview} alt="" className="h-20 rounded-md object-cover" /> : <Badge>Current image kept</Badge>}
              <Button
                size="sm"
                variant="ghost"
                icon={<X className="size-4" />}
                onClick={() => {
                  setImage(null);
                  setRemoveImage(true);
                }}
              >
                Remove image
              </Button>
            </div>
          ) : (
            <Upload kind="photo" onFiles={([f]) => setImage(f)} onLink={(url) => setBody((b) => `${b}${b ? '\n\n' : ''}${url}`)} />
          )}
        </div>
        <Switch checked={pinned} onChange={setPinned} label="Pin to the top" />
        <Switch checked={requireAck} onChange={setRequireAck} label="Must read" description="Everyone gets a notification and taps “I've read this”. Use for travel info, deadlines and safety." />
        <ScopeVisibility teamId={teamId} suffix="— there are no replies; questions go to your team chat." />
        {requireAck && <Banner tone="info">Captains and mentors can see who hasn't read it yet.</Banner>}
      </div>
    </Dialog>
  );
}
