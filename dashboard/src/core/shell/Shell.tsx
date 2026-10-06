import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router';
import { AlertTriangle, Search } from 'lucide-react';
import { AppShell, Banner, Dialog, ErrorState, IconButton, Kbd, ModKey, Spinner } from '@teamhub/ui';
import { runtime, SHORTCUTS, useSchemaStatus, useSession, useSettingsRow, useShortcut } from '@teamhub/sdk';
import { Sidebar } from './Sidebar';
import { CommandMenu } from './CommandMenu';
import { NotificationsButton } from './Notifications';
import { ModuleRoute } from './ModuleRoute';
import { ErrorBoundary } from './ErrorBoundary';
import { Home } from '../home/Home';
import { markTourSeen, onOpenTour, tourSeen } from './tourState';

const People = lazy(() => import('../people/PeoplePage'));
const Admin = lazy(() => import('../admin/AdminPage'));
const MyProfile = lazy(() => import('../people/MyProfile'));
const Tour = lazy(() => import('./Tour'));

export function Shell() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const lastG = useRef(0);
  const modules = runtime().modules;
  const { me } = useSession();
  // First visit on this browser: the welcome tour (also from the account menu and Admin > Help).
  const [tour, setTour] = useState(() => !!me && !tourSeen(me.id));
  useEffect(() => onOpenTour(() => setTour(true)), []);
  const closeTour = () => {
    if (me) markTourSeen(me.id);
    setTour(false);
  };

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);
  useShortcut('/', () => setCmdOpen(true));
  useShortcut('?', () => setHelpOpen(true));
  useShortcut('g', () => {
    lastG.current = Date.now();
  });
  useShortcut('h', () => {
    if (Date.now() - lastG.current < 800) nav('/');
  });

  const title = loc.pathname === '/' ? 'Home' : modules.find((m) => loc.pathname.startsWith(`/${m.manifest.id}`))?.manifest.name ?? (loc.pathname.startsWith('/people') ? 'People' : loc.pathname.startsWith('/admin') ? 'Admin' : runtime().config.program.name);

  return (
    <>
      <AppShell
        sidebar={(close) => <Sidebar onNavigate={close} onSearch={() => setCmdOpen(true)} />}
        mobileTitle={title}
        mobileActions={
          <>
            <IconButton label="Search" onClick={() => setCmdOpen(true)}>
              <Search className="size-5" />
            </IconButton>
            <NotificationsButton />
          </>
        }
        banner={<AdminBanners />}
      >
        <ErrorBoundary key={loc.pathname.split('/')[1]}>
          <Suspense
            fallback={
              <div className="grid h-64 place-items-center">
                <Spinner />
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/people/*" element={<People />} />
              <Route path="/me" element={<MyProfile />} />
              <Route path="/admin/*" element={<Admin />} />
              {modules.map((m) => (
                <Route key={m.manifest.id} path={`/${m.manifest.id}/*`} element={<ModuleRoute module={m} />} />
              ))}
              <Route path="*" element={<ErrorState title="Page not found" error="This tab may not be enabled for your team." retry={() => nav('/')} />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AppShell>
      <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} />
      {tour && (
        <Suspense fallback={null}>
          <Tour onClose={closeTour} />
        </Suspense>
      )}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen} title="Keyboard shortcuts" size="sm">
        <ul className="space-y-2 text-[13.5px]">
          {SHORTCUTS.map(([k, d]) => (
            <li key={k} className="flex items-center justify-between gap-4">
              <span className="text-muted">{d}</span>
              <Kbd>{k.startsWith('Mod ') ? <><ModKey /> {k.slice(4)}</> : k}</Kbd>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}

/** Admin-only banners: DB behind code (spec §5.7) and storage warnings (spec §11.4). */
function AdminBanners() {
  const { me } = useSession();
  const schema = useSchemaStatus();
  const settings = useSettingsRow();
  if (!me?.isAdmin) return null;
  const banners = [];
  if (schema.problems.length) {
    banners.push(
      <Banner
        key="schema"
        tone="warning"
        title="Database update available"
        className="rounded-none"
      >
        Your site was updated but the database wasn't yet ({schema.problems.join(', ')}). On your computer run <code>npm run setup</code> &gt; <strong>Update</strong>.
      </Banner>,
    );
  }
  const last = settings.data?.last_keepalive;
  if (settings.data && (!last || Date.now() - new Date(last).getTime() > 6 * 86_400_000)) {
    banners.push(
      <Banner key="ka" tone="info" className="rounded-none" title="Keep-alive hasn't pinged recently">
        Free Supabase projects pause after 7 days without activity. Check the keep-alive workflow in Admin &gt; Keep-alive.
      </Banner>,
    );
  }
  return banners.length ? <div className="border-b border-border">{banners}</div> : null;
}

export function DbBehind({ name }: { name: string }) {
  return (
    <div className="mx-auto max-w-md p-10 text-center">
      <AlertTriangle className="mx-auto size-8 text-warning" />
      <p className="mt-3 font-semibold">{name} needs a database update</p>
      <p className="mt-1 text-[13px] text-muted">
        The site has a newer version of this tab than the database. An admin can fix this by running <code>npm run setup</code> &gt; Update. Other tabs keep working.
      </p>
    </div>
  );
}
