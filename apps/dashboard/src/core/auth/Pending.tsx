import { Clock, LogOut, RefreshCw, UserX } from 'lucide-react';
import { Button } from '@teamhub/ui';
import { runtime, useSession } from '@teamhub/sdk';
import { AuthLayout, TeamLogo } from './AuthLayout';

const TYPE = { member: 'Member', captain: 'Captain', mentor: 'Mentor' } as const;

/** Pending users can sign in but only see this screen (spec §7.5). */
export function PendingScreen({ missingProfile }: { missingProfile?: boolean }) {
  const { me, signOut, refreshMe } = useSession();
  const teams = runtime().config.teams;
  const requests = me?.memberships.filter((m) => m.status === 'pending') ?? [];
  return (
    <AuthLayout title="Waiting for approval" subtitle={me ? `Hi ${me.profile.display_name.split(' ')[0]}!` : undefined}>
      <div className="space-y-4 text-[13.5px]">
        <div className="flex items-start gap-3 rounded-md bg-bg-subtle p-3">
          <Clock className="mt-0.5 size-5 shrink-0 text-accent" />
          <p className="text-muted">
            {missingProfile
              ? "Your account exists but your profile couldn't be loaded. If this persists, ask an admin."
              : 'A captain or mentor needs to approve your account. Let them know you signed up. This page updates once you are in.'}
          </p>
        </div>
        {requests.length > 0 && (
          <ul className="space-y-2">
            {requests.map((m) => {
              const t = teams.find((x) => x.id === m.team_id);
              return (
                <li key={m.team_id} className="flex items-center gap-3 rounded-md border border-border p-2.5">
                  <TeamLogo teamId={m.team_id} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{t?.name ?? 'Team'}</span>
                    <span className="text-[12px] text-muted">Requested: {TYPE[m.requested_type ?? m.type]}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {me && !requests.length && !missingProfile && (
          <p className="text-[12.5px] text-muted">You don't have a pending team request. Ask an admin to add you to a team.</p>
        )}
        <div className="flex gap-2">
          <Button className="flex-1" icon={<RefreshCw className="size-4" />} onClick={refreshMe}>
            Check again
          </Button>
          <Button className="flex-1" icon={<LogOut className="size-4" />} onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}

export function InactiveScreen() {
  const { signOut } = useSession();
  return (
    <AuthLayout title="Account inactive">
      <div className="space-y-4 text-[13.5px]">
        <div className="flex items-start gap-3 rounded-md bg-bg-subtle p-3">
          <UserX className="mt-0.5 size-5 shrink-0 text-muted" />
          <p className="text-muted">Your account has been deactivated. If you're back on the team, ask a mentor to reactivate you.</p>
        </div>
        <Button className="w-full" icon={<LogOut className="size-4" />} onClick={signOut}>
          Sign out
        </Button>
      </div>
    </AuthLayout>
  );
}
