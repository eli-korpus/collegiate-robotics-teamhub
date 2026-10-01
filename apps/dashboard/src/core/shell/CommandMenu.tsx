import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { FileText, Home, Shield, User, Users, Zap } from 'lucide-react';
import { Avatar, CommandBar, matches, type CommandSection } from '@teamhub/ui';
import { allQuickActions, canWith, runtime, useActivePeople, useSession, useSupabase, type SearchResult } from '@teamhub/sdk';

/** ⌘K: Go to (tabs, people) · Actions (quickActions, permission-filtered) · Search (providers) — spec §10.2. */
export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const nav = useNavigate();
  const sb = useSupabase();
  const { me } = useSession();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ module: string; items: SearchResult[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const people = useActivePeople(null);
  const modules = runtime().modules;

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  // Debounced search across module providers (5 results each, no index tables).
  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const out = await Promise.all(
        modules
          .filter((m) => m.client.search)
          .map(async (m) => {
            try {
              return { module: m.manifest.name, items: (await m.client.search!(sb, q.trim())).slice(0, 5) };
            } catch {
              return { module: m.manifest.name, items: [] };
            }
          }),
      );
      if (!cancelled) {
        setResults(out.filter((r) => r.items.length));
        setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open, modules, sb]);

  const sections = useMemo<CommandSection[]>(() => {
    const go = (href: string) => () => nav(href);
    const gotoAll: { id: string; label: string; keywords?: string; hint?: string; icon: ReactNode; onSelect: () => void }[] = [
      { id: 'home', label: 'Home', icon: <Home />, onSelect: go('/') },
      ...modules.map((m) => {
        const I = m.client.icon;
        return { id: `m-${m.manifest.id}`, label: m.manifest.name, keywords: `${m.manifest.name} ${m.manifest.summary}`, hint: m.manifest.summary, icon: <I />, onSelect: go(`/${m.manifest.id}`) };
      }),
      { id: 'people', label: 'People', icon: <Users />, onSelect: go('/people') },
      { id: 'me', label: 'My profile', icon: <User />, onSelect: go('/me') },
      ...(me?.isAdmin ? [{ id: 'admin', label: 'Admin', icon: <Shield />, onSelect: go('/admin') }] : []),
    ];
    const goto = gotoAll.filter((i) => !q || matches(i.keywords ?? String(i.label), q));
    const actions = allQuickActions()
      .filter((a) => !a.perm || canWith(me, a.perm))
      .filter((a) => !q || matches(`${a.label} ${a.keywords ?? ''}`, q))
      .map((a) => ({ id: `a-${a.module}-${a.id}`, label: a.label, hint: a.hint, icon: a.icon ? <a.icon /> : <Zap />, onSelect: go(a.href) }));
    const ppl = q
      ? people
          .filter((p) => matches(p.name, q))
          .slice(0, 5)
          .map((p) => ({ id: `p-${p.id}`, label: p.name, hint: p.positions[0], icon: <Avatar name={p.name} src={p.avatarUrl} size={18} />, onSelect: go(`/people/${p.id}`) }))
      : [];
    return [
      { title: 'Go to', items: goto.slice(0, q ? 8 : 12) },
      { title: 'Actions', items: actions.slice(0, q ? 8 : 6) },
      { title: 'People', items: ppl },
      ...results.map((r) => ({
        title: r.module,
        items: r.items.map((it) => ({ id: `s-${r.module}-${it.id}`, label: it.title, hint: it.subtitle, icon: <FileText />, onSelect: go(it.href) })),
      })),
    ];
  }, [q, modules, people, results, me, nav]);

  return <CommandBar open={open} onOpenChange={onOpenChange} query={q} onQueryChange={setQ} sections={sections} loading={loading} placeholder="Search, jump to a tab, or run an action…" />;
}
