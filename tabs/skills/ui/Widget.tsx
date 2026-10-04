import { Link } from 'react-router';
import { GraduationCap } from 'lucide-react';
import { Card, CardHeader } from '@teamhub/ui';
import { useMe } from '@teamhub/sdk';
import { nextSkills, useSignoffs, useSkills } from './Routes';

export default function NextSkills({ teamId }: { teamId: string | null }) {
  const me = useMe();
  const skills = useSkills();
  const signoffs = useSignoffs();
  const next = nextSkills((skills.data ?? []).filter((s) => !teamId || !s.team_id || s.team_id === teamId), signoffs.data ?? [], me.id);
  if (!next.length) return null;
  return (
    <Card>
      <CardHeader icon={<GraduationCap className="size-4" />} title="Skills you can learn next" action={<Link to="/skills" className="text-[12.5px] text-accent hover:underline">All skills</Link>} />
      <ul className="space-y-1 px-4 pb-3 text-[13px]">
        {next.slice(0, 4).map((s) => (
          <li key={s.id} className="truncate">
            {s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">
                {s.name}
              </a>
            ) : (
              s.name
            )}
            {s.category && <span className="text-faint"> · {s.category}</span>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
