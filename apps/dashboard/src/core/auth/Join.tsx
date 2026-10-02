import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { Check } from 'lucide-react';
import { Banner, Button, Field, Input, Segmented, Textarea, VisibilityNote, cn } from '@teamhub/ui';
import { friendlyError, isMultiTeam, runtime, useSession, useSupabase } from '@teamhub/sdk';
import { AuthLayout, TeamLogo } from './AuthLayout';

type ReqType = 'member' | 'captain' | 'mentor';

/** Public signup (spec §7.5): account is created immediately as pending; a captain/mentor approves it. */
export function Join() {
  const sb = useSupabase();
  const { session } = useSession();
  const teams = runtime().config.teams;
  const multi = isMultiTeam();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [picked, setPicked] = useState<string[]>(multi ? [] : [teams[0].id]);
  const [type, setType] = useState<ReqType>('member');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Navigate to="/" replace />;

  return (
    <AuthLayout title="Join the team" subtitle="Create your account. A captain or mentor will approve it." wide>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!picked.length) return setError('Pick at least one team.');
          if (password.length < 8) return setError('Use at least 8 characters for your password.');
          setBusy(true);
          setError(null);
          const { error } = await sb.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { name: name.trim(), teams: picked, requested_type: type, note: note.trim() || null } },
          });
          setBusy(false);
          if (error) setError(/registered/i.test(error.message) ? 'That email already has an account. Try signing in.' : friendlyError(error));
        }}
      >
        {error && <Banner tone="danger">{error}</Banner>}
        <Field label="Your name" hint="First and last name, as your team knows you.">
          {(id) => <Input id={id} required maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">{(id) => <Input id={id} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Field label="Password" hint="At least 8 characters">
            {(id) => <Input id={id} type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
        </div>

        {multi && (
          <fieldset className="space-y-2">
            <legend className="text-[13px] font-medium">Which team(s)?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {teams.map((t) => {
                const on = picked.includes(t.id);
                return (
                  <button
                    type="button"
                    key={t.id}
                    aria-pressed={on}
                    onClick={() => setPicked(on ? picked.filter((x) => x !== t.id) : [...picked, t.id])}
                    className={cn('flex items-center gap-3 rounded-md border p-2.5 text-left transition-colors', on ? 'border-accent bg-accent-soft' : 'border-border hover:bg-bg-subtle')}
                  >
                    <TeamLogo teamId={t.id} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{t.name}</span>
                      {t.number && <span className="block text-[12px] text-muted">#{t.number}</span>}
                    </span>
                    {on && <Check className="size-4 text-accent" />}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="space-y-1.5">
          <p className="text-[13px] font-medium">I am a…</p>
          <Segmented<ReqType>
            value={type}
            onChange={setType}
            options={[
              { value: 'member', label: 'Team member' },
              { value: 'captain', label: 'Captain' },
              { value: 'mentor', label: 'Mentor / coach' },
            ]}
          />
          {type !== 'member' && <p className="text-[12px] text-muted">Captain and mentor requests are approved by a mentor or admin.</p>}
        </div>

        <Field label="Note for the approver" optional hint='e.g. "New build mentor, Sam’s mom"'>
          {(id) => <Textarea id={id} rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        <VisibilityNote>Your name and note are shown to the captains and mentors who approve requests.</VisibilityNote>

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
          Request to join
        </Button>
      </form>
      <div className="mt-5 border-t border-border pt-4 text-center text-[13px]">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
