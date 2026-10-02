import { PositionBadge } from '@teamhub/ui';
import { useSignoffs, useSkills } from './Routes';

/** Skill badges on a profile: styled differently from position badges (spec §13.9). */
export default function SkillBadges({ userId }: { userId: string }) {
  const skills = useSkills();
  const signoffs = useSignoffs();
  const have = new Set((signoffs.data ?? []).filter((s) => s.user_id === userId).map((s) => s.skill_id));
  const list = (skills.data ?? []).filter((s) => have.has(s.id));
  if (!list.length) return <p className="text-[13px] text-faint">No skills signed off yet.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((s) => (
        <PositionBadge key={s.id} name={s.name} kind="skill" />
      ))}
    </div>
  );
}
