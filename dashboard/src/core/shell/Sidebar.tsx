import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { Check, ChevronsUpDown, Compass, ExternalLink, Home as HomeIcon, Link2, LogOut, MessagesSquare, Monitor, Moon, Search, Settings, Shield, Sun, User, Users } from 'lucide-react';
import { Avatar, Kbd, Menu, ModKey, SidebarItem, SidebarSection, TeamDot, cn, useMediaQuery, safeHref } from '@teamhub/ui';
import { canWith, isMultiTeam, runtime, setTeamScope, useCan, useToolLink, useMe, useSession, useSignedUrls, useSupabase, useTeamScope, useAllTeamsLabel, useViewableTeams, type LoadedModule } from '@teamhub/sdk';
import { nav } from '../../generated/nav';
import { useAvailableUpdate } from './updates';
import { ProgramLogo, TeamLogo } from '../auth/AuthLayout';
import { NotificationsButton } from './Notifications';
import { useTheme } from './theme';
import { openTour } from './tourState';

const CATEGORY_LABEL: Record<string, string> = { team: 'Team', engineering: 'Engineering', competition: 'Competition', outreach: 'Outreach & Business' };

function ModuleItem({ m, onNavigate }: { m: LoadedModule; onNavigate: () => void }) {
  const count = m.client.useBadge?.();
  const Icon = m.client.icon;
  return (
    <SidebarItem
      as={NavLink}
      to={`/${m.manifest.id}`}
      icon={<Icon />}
      label={m.manifest.name}
      count={count}
      onClick={onNavigate}
      className={({ isActive }: { isActive: boolean }) =>
        cn('flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13.5px] transition-colors', isActive ? 'bg-accent-soft font-medium text-fg [&_svg]:text-accent' : 'text-fg/85 hover:bg-bg-subtle')
      }
    />
  );
}

export function Sidebar({ onNavigate, onSearch }: { onNavigate: () => void; onSearch: () => void }) {
  const loc = useLocation();
  const { me } = useSession();
  const modules = runtime().modules;
  const byId = new Map(modules.filter((m) => !m.manifest.viewPerm || canWith(me, m.manifest.viewPerm)).map((m) => [m.manifest.id, m]));
  const wide = useMediaQuery('(min-width: 1024px)');
  const update = useAvailableUpdate();
  const canApprove = useCan('people.approve_members');
  const chat = useToolLink('team_chat');
  const pendingCount = usePendingCount(canApprove);

  return (
    <nav aria-label="Main" className="flex h-full min-h-0 flex-col">
      <div className="px-3 pb-2 pt-3">
        <TeamSwitcher />
      </div>
      <div className="px-3 pb-1">
        <button
          type="button"
          onClick={onSearch}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-[13px] text-faint shadow-sm hover:text-muted"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Search…</span>
          <Kbd>
            <ModKey />K
          </Kbd>
        </button>
      </div>
      <div className="min-h-0 flex-1 relative overflow-y-auto pb-3">
        <SidebarSection collapsible={false}>
          <SidebarItem as={NavLink} to="/" end icon={<HomeIcon />} label="Home" active={loc.pathname === '/'} onClick={onNavigate} />
        </SidebarSection>
        {nav.map((section) => (
          <SidebarSection key={section.category} title={CATEGORY_LABEL[section.category]}>
            {section.items.map((id) => {
              const m = byId.get(id);
              return m ? <ModuleItem key={id} m={m} onNavigate={onNavigate} /> : null;
            })}
          </SidebarSection>
        ))}
        <SidebarSection title="Program" collapsible={false}>
          <SidebarItem as={NavLink} to="/people" icon={<Users />} label="People" count={pendingCount || undefined} active={loc.pathname.startsWith('/people')} onClick={onNavigate} />
          <SidebarItem as={NavLink} to="/links" icon={<Link2 />} label="Links" active={loc.pathname.startsWith('/links')} onClick={onNavigate} />
          {me?.isAdmin && <SidebarItem as={NavLink} to="/admin" icon={<Shield />} label="Admin" dot={!!update} title={update ? `TeamHub ${update.version} is available` : undefined} active={loc.pathname.startsWith('/admin')} onClick={onNavigate} />}
        </SidebarSection>
      </div>
      <div className="space-y-1 border-t border-border p-2">
        {chat && (
          <a
            href={safeHref(chat.url)}
            target="_blank"
            rel="noreferrer noopener"
            className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] text-fg/85 hover:bg-bg-subtle"
            title="Discussion happens in your team's chat: TeamHub has no chat by design."
          >
            <MessagesSquare className="size-[17px]" />
            <span className="flex-1 truncate">{chat.label}</span>
            <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
        <div className="flex items-center gap-1">
          <UserMenu />
          {wide && <NotificationsButton />}
        </div>
      </div>
    </nav>
  );
}

function TeamSwitcher() {
  const c = runtime().config;
  const scope = useTeamScope();
  const multi = isMultiTeam();
  // Only teams this person can see items for: picking any other team would just look empty.
  const teams = useViewableTeams();
  const allLabel = useAllTeamsLabel();
  const stale = multi && scope !== null && !teams.some((t) => t.id === scope);
  useEffect(() => {
    if (stale) setTeamScope(null);
  }, [stale]);
  const current = c.teams.find((t) => t.id === scope) ?? (multi && teams.length === 1 ? teams[0] : undefined);
  const header = (
    <span className="flex min-w-0 items-center gap-2.5">
      {current ? <TeamLogo teamId={current.id} size={30} /> : <ProgramLogo size={30} />}
      <span className="min-w-0 text-left">
        <span className="block truncate text-[13.5px] font-semibold leading-tight">{current?.name ?? c.program.name}</span>
        <span className="block truncate text-[11.5px] text-muted">{current ? (current.number ? `#${current.number}` : 'Team') : multi ? allLabel : c.teams[0]?.number ? `#${c.teams[0].number}` : ''}</span>
      </span>
    </span>
  );
  if (!multi || teams.length < 2) return <div className="flex h-11 items-center px-1">{header}</div>;
  return (
    <Menu
      align="start"
      label="Show items for"
      trigger={
        <button type="button" className="flex h-11 w-full items-center justify-between gap-2 rounded-md px-1 hover:bg-bg-subtle" aria-label="Switch team">
          {header}
          <ChevronsUpDown className="size-4 shrink-0 text-muted" />
        </button>
      }
      items={[
        { label: allLabel, icon: scope === null ? <Check /> : <span />, onSelect: () => setTeamScope(null) },
        ...teams.map((t) => ({
          label: (
            <span className="flex items-center gap-2">
              <TeamDot color={t.color} /> {t.name}
            </span>
          ),
          icon: scope === t.id ? <Check /> : <span />,
          onSelect: () => setTeamScope(t.id),
        })),
      ]}
      footer={`Items for everyone in ${c.program.name} show for every team.`}
    />
  );
}

function UserMenu() {
  const me = useMe();
  const { signOut } = useSession();
  const nav = useNavigate();
  // Only this person's picture: the sidebar shouldn't wait for the whole People directory.
  const pic = useSignedUrls('avatars', [me.profile.avatar_path]);
  const avatar = me.profile.avatar_path ? pic.data?.get(me.profile.avatar_path) : null;
  const { pref, setPref } = useTheme();
  return (
    <Menu
      align="start"
      trigger={
        <button type="button" className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 hover:bg-bg-subtle" aria-label="Account menu">
          <Avatar name={me.profile.display_name} src={avatar} size={26} />
          <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium">{me.profile.display_name}</span>
          <Settings className="size-4 shrink-0 text-muted" />
        </button>
      }
      items={[
        { label: 'My profile', icon: <User />, onSelect: () => nav('/me') },
        { label: 'Take the tour', icon: <Compass />, onSelect: openTour },
        { label: 'Light', icon: pref === 'light' ? <Check /> : <Sun />, onSelect: () => setPref('light'), separatorBefore: true },
        { label: 'Dark', icon: pref === 'dark' ? <Check /> : <Moon />, onSelect: () => setPref('dark') },
        { label: 'System', icon: pref === 'system' ? <Check /> : <Monitor />, onSelect: () => setPref('system') },
        { label: 'Sign out', icon: <LogOut />, onSelect: signOut, separatorBefore: true },
      ]}
      footer={`TeamHub ${runtime().config.version}`}
    />
  );
}

/** People waiting for approval (new sign-ups and team join requests), without loading the whole directory. */
function usePendingCount(enabled: boolean): number {
  const sb = useSupabase();
  const q = useQuery({
    queryKey: ['core', 'people-pending'],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const [p, m] = await Promise.all([sb.from('profiles').select('id').eq('status', 'pending'), sb.from('memberships').select('user_id').eq('status', 'pending')]);
      if (p.error) throw p.error;
      if (m.error) throw m.error;
      return new Set([...(p.data ?? []).map((x) => x.id as string), ...(m.data ?? []).map((x) => x.user_id as string)]).size;
    },
  });
  return enabled ? q.data ?? 0 : 0;
}
