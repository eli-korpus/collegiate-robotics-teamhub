import { useState } from 'react';
import { ExternalLink, MessagesSquare } from 'lucide-react';
import { Button, Favicon, Input, Select, cn, hostOf } from '@teamhub/ui';
import { useLinks, type LinkRow } from './hooks';
import { TeamScopePicker } from './teams';

// ── Tool links (spec §10.6) ────────────────────────────────────────────────
/** Small favicon chips of the team's tool links for the given slots ("Quick links" in a tab header). */
export function ToolLinks({ slots, className, label = 'Quick links' }: { slots: string[]; className?: string; label?: string }) {
  const links = useLinks();
  const shown = (links.data ?? []).filter((l) => l.slot && slots.includes(l.slot)).sort((a, b) => slots.indexOf(a.slot!) - slots.indexOf(b.slot!));
  if (!shown.length) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)} aria-label={label}>
      {shown.map((l) => (
        <a
          key={l.id}
          href={l.url}
          target="_blank"
          rel="noreferrer noopener"
          title={`${l.label} — ${hostOf(l.url)}`}
          className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 text-[12px] font-medium text-fg shadow-sm hover:bg-bg-subtle"
        >
          <Favicon url={l.url} size={14} /> {l.label}
        </a>
      ))}
    </div>
  );
}

/** "Questions? Ask in Team chat ↗" — the answer to "can we chat in TeamHub?" (spec §1.4). */
export function TeamChatLink({ prefix = 'Questions? Ask in', className }: { prefix?: string; className?: string }) {
  const links = useLinks();
  const chat = links.data?.find((l) => l.slot === 'team_chat');
  if (!chat) return null;
  return (
    <p className={cn('flex items-center gap-1.5 text-[12.5px] text-muted', className)}>
      <MessagesSquare className="size-3.5" /> {prefix}{' '}
      <a href={chat.url} target="_blank" rel="noreferrer noopener" className="font-medium text-accent hover:underline">
        {chat.label} <ExternalLink className="inline size-3" aria-hidden />
      </a>
    </p>
  );
}

// ── Link editor used by tool links / bulletin ──────────────────────────────
export function LinkEditor({
  initial,
  onSave,
  onCancel,
  showSection,
  showSlot,
  sections = [],
}: {
  initial?: Partial<LinkRow>;
  onSave: (v: Pick<LinkRow, 'label' | 'url' | 'description' | 'section' | 'slot' | 'team_id'>) => Promise<void> | void;
  onCancel: () => void;
  showSection?: boolean;
  showSlot?: boolean;
  sections?: string[];
}) {
  const [v, setV] = useState({
    label: initial?.label ?? '',
    url: initial?.url ?? '',
    description: initial?.description ?? '',
    section: initial?.section ?? '',
    slot: initial?.slot ?? '',
    team_id: initial?.team_id ?? null,
  });
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave({ ...v, description: v.description || null, section: v.section || null, slot: v.slot || null });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="block text-[13px] font-medium">Label</span>
          <Input required maxLength={80} value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} />
        </label>
        <label className="space-y-1.5">
          <span className="block text-[13px] font-medium">URL</span>
          <Input required type="url" pattern="https?://.*" placeholder="https://" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} />
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="block text-[13px] font-medium">
          Description <span className="font-normal text-faint">(optional)</span>
        </span>
        <Input maxLength={300} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </label>
      {showSection && (
        <label className="block space-y-1.5">
          <span className="block text-[13px] font-medium">Section</span>
          <Input list="th-link-sections" value={v.section} placeholder="e.g. Programming" onChange={(e) => setV({ ...v, section: e.target.value })} />
          <datalist id="th-link-sections">
            {sections.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
      )}
      {showSlot && (
        <label className="block space-y-1.5">
          <span className="block text-[13px] font-medium">Pin as tool link</span>
          <Select value={v.slot} onChange={(e) => setV({ ...v, slot: e.target.value })}>
            <option value="">Not pinned</option>
            {Object.entries(TOOL_SLOT_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </label>
      )}
      <TeamScopePicker value={v.team_id} onChange={(team_id) => setV({ ...v, team_id })} perm="core.edit_links" />
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" loading={busy}>
          Save link
        </Button>
      </div>
    </form>
  );
}

export const TOOL_SLOT_LABELS: Record<string, string> = {
  team_chat: 'Team chat',
  portfolio: 'Portfolio doc',
  code_repo: 'Code repository',
  cad: 'CAD (Onshape)',
  drive: 'Shared Drive folder',
  website: 'Team website',
  social: 'Social media',
  ftcscout: 'FTCScout team page',
  manual: 'Competition manual',
  gm0: 'Game Manual 0',
  ftc_docs: 'FTC Docs',
  qa_forum: 'Rules Q&A forum',
  scouting_sheet: 'Scouting sheet',
  printer_dashboard: 'Printer dashboard',
  outreach_doc: 'Outreach log doc',
  sdk_docs: 'SDK / library docs',
};
