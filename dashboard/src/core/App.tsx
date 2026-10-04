import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfirmProvider, Spinner, Toaster } from '@teamhub/ui';
import { SessionProvider, useSession } from '@teamhub/sdk';
const Login = lazy(() => import('./auth/Login').then((m) => ({ default: m.Login })));
const Join = lazy(() => import('./auth/Join').then((m) => ({ default: m.Join })));
import { PendingScreen, InactiveScreen } from './auth/Pending';
const ResetPassword = lazy(() => import('./auth/ResetPassword').then((m) => ({ default: m.ResetPassword })));
import { Shell } from './shell/Shell';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
});

const ICalHelp = lazy(() => import('./auth/PublicHelp'));

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
        <SessionProvider>
          <ConfirmProvider>
            <Routes>
              <Route path="/login" element={<Suspense fallback={<FullPageSpinner />}><Login /></Suspense>} />
              <Route path="/join" element={<Suspense fallback={<FullPageSpinner />}><Join /></Suspense>} />
              <Route path="/reset-password" element={<Suspense fallback={<FullPageSpinner />}><ResetPassword /></Suspense>} />
              <Route
                path="/help/join"
                element={
                  <Suspense fallback={<FullPageSpinner />}>
                    <ICalHelp />
                  </Suspense>
                }
              />
              <Route path="/*" element={<AuthGate />} />
            </Routes>
            <Toaster />
          </ConfirmProvider>
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export function FullPageSpinner() {
  return (
    <div className="grid h-dvh place-items-center">
      <Spinner />
    </div>
  );
}

function AuthGate() {
  const { session, loading, me, meLoading } = useSession();
  const loc = useLocation();
  if (loading || meLoading) return <FullPageSpinner />;
  if (!session) {
    const next = loc.pathname + loc.search;
    return <Navigate to={next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login'} replace />;
  }
  if (!me) return <PendingScreen missingProfile />;
  if (me.profile.status === 'pending') return <PendingScreen />;
  if (me.profile.status === 'inactive') return <InactiveScreen />;
  return <Shell />;
}
