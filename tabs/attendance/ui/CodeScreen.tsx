import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { IconButton, QRCode } from '@teamhub/ui';
import { friendlyError, runtime, useRealtime, useSupabase } from '@teamhub/sdk';
import { useAttSettings } from '../data';

/** Full-screen rotating 4-digit code + QR for self check-in (spec §13.1). */
export function CodeScreen() {
  const { id } = useParams();
  const sb = useSupabase();
  const nav = useNavigate();
  const qc = useQueryClient();
  const settings = useAttSettings();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(settings.codeRotateSeconds);
  const count = useQuery({
    queryKey: ['attendance', 'code-count', id],
    queryFn: async () => {
      const { count } = await sb.from('att_presence').select('*', { count: 'exact', head: true }).eq('session_id', id!);
      return count ?? 0;
    },
  });
  useRealtime('att_presence', `session_id=eq.${id}`, () => qc.invalidateQueries({ queryKey: ['attendance', 'code-count', id] }));

  useEffect(() => {
    let cancelled = false;
    const rotate = async () => {
      const { data, error } = await sb.rpc('att_rotate_code', { p_session: id, p_seconds: settings.codeRotateSeconds });
      if (cancelled) return;
      if (error) setError(friendlyError(error));
      else {
        setCode((data as { code: string }).code);
        setLeft(settings.codeRotateSeconds);
      }
    };
    rotate();
    const t = setInterval(rotate, settings.codeRotateSeconds * 1000);
    const tick = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
      clearInterval(tick);
    };
  }, [sb, id, settings.codeRotateSeconds]);

  const url = code ? `${location.origin}${import.meta.env.BASE_URL}attendance/check-in?s=${id}&c=${code}` : '';
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-surface p-6 text-center">
      <IconButton label="Close" className="absolute right-4 top-4" onClick={() => nav(`/attendance/session/${id}`)}>
        <X className="size-6" />
      </IconButton>
      <p className="text-[18px] font-medium text-muted">Check in to practice · {runtime().config.program.name}</p>
      {error ? (
        <p className="text-danger">{error}</p>
      ) : (
        <>
          <p className="tabular text-[min(28vw,200px)] font-bold leading-none tracking-[0.12em]" aria-live="polite">
            {code ?? '····'}
          </p>
          {code && <QRCode value={url} size={220} label="Scan to check in" />}
          <p className="text-[15px] text-muted">
            Open TeamHub &gt; Attendance &gt; <strong>Check in</strong> and type the code, or scan the QR. New code in <span className="tabular">{left}s</span>.
          </p>
        </>
      )}
      <p className="tabular text-[22px] font-semibold">{count.data ?? 0} checked in</p>
    </div>
  );
}
