import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, LogOut } from 'lucide-react';
import { Banner, Button, Input, Spinner, VisibilityNote, toDateInput, toast } from '@teamhub/ui';
import { friendlyError, TeamBadge, useMe, useSupabase } from '@teamhub/sdk';
import { sessionTitle, useAttSettings, type Session } from '../data';

/** Member check-in page: pick today's practice (if several) and type the code; QR links pre-fill both. */
export function CheckIn() {
  const sb = useSupabase();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [sessionId, setSessionId] = useState<string | null>(params.get('s'));
  const today = useQuery({
    queryKey: ['attendance', 'today-open'],
    queryFn: async () => {
      const { data, error } = await sb.from('att_sessions').select('*').eq('date', toDateInput(new Date())).eq('closed', false);
      if (error) throw error;
      return data as Session[];
    },
  });
  useEffect(() => {
    if (!sessionId && today.data?.length === 1) setSessionId(today.data[0].id);
  }, [today.data, sessionId]);

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <button type="button" onClick={() => nav('/attendance')} className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Attendance
      </button>
      <h1 className="mb-5 text-[22px] font-semibold tracking-tight">Check in</h1>
      {today.isLoading ? (
        <Spinner />
      ) : sessionId ? (
        <CheckInForm sessionId={sessionId} initialCode={params.get('c') ?? ''} />
      ) : today.data?.length ? (
        <ul className="space-y-2">
          {today.data.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => setSessionId(s.id)} className="flex w-full items-center justify-between rounded-lg border border-border bg-surface p-4 text-left hover:bg-bg-subtle">
                <span className="font-medium">{sessionTitle(s)}</span>
                <TeamBadge teamId={s.team_id} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Banner tone="info" title="No practice is open right now">
          When a captain or mentor starts today's practice and shows the code, you can check in here.
        </Banner>
      )}
    </div>
  );
}

export function CheckInForm({ sessionId, initialCode = '', onDone }: { sessionId: string; initialCode?: string; onDone?: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const settings = useAttSettings();
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const auto = useRef(false);

  const submit = async (c: string) => {
    setBusy(true);
    setError(null);
    const { error } = await sb.rpc('att_check_in', { p_session: sessionId, p_code: c });
    setBusy(false);
    if (error) return setError(friendlyError(error));
    setDone(true);
    qc.invalidateQueries({ queryKey: ['attendance'] });
    onDone?.();
  };
  useEffect(() => {
    if (initialCode.length === 4 && !auto.current) {
      auto.current = true;
      submit(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  if (done)
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-14 text-success" />
        <p className="text-[18px] font-semibold">You're checked in, {me.profile.display_name.split(' ')[0]}!</p>
        {settings.trackHours && (
          <Button
            icon={<LogOut className="size-4" />}
            onClick={async () => {
              const { error } = await sb.rpc('att_check_out', { p_session: sessionId });
              if (error) return toast.error(friendlyError(error));
              toast.success('Checked out — see you next time');
            }}
          >
            Check out when you leave
          </Button>
        )}
      </div>
    );

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit(code);
      }}
    >
      {error && <Banner tone="danger">{error}</Banner>}
      <label className="block space-y-1.5">
        <span className="text-[13px] font-medium">Code on the screen</span>
        <Input
          autoFocus
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="h-16 text-center text-[32px] font-bold tracking-[0.4em]"
          aria-label="Check-in code"
        />
      </label>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={code.length !== 4}>
        Check in
      </Button>
      <VisibilityNote>Your attendance is visible to you and to the captains and mentors who take attendance.</VisibilityNote>
    </form>
  );
}
