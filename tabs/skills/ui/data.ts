import { useRows } from '@teamhub/sdk';

export interface Skill {
  id: string;
  team_id: string | null;
  name: string;
  category: string | null;
  subteam_id: string | null;
  description: string | null;
  url: string | null;
  requires: string[];
}

export interface Signoff {
  skill_id: string;
  user_id: string;
  signed_by: string | null;
  signed_at: string;
}

export const useSkills = () => useRows<Skill>(['skills', 'list'], (sb) => sb.from('skill_skills').select('*').order('category').order('name'));

export const useSignoffs = () => useRows<Signoff>(['skills', 'signoffs'], (sb) => sb.from('skill_signoffs').select('*'));

/** Skills whose prerequisites this person has, but not the skill itself. */
export function nextSkills(skills: Skill[], signoffs: Signoff[], userId: string): Skill[] {
  const have = new Set(signoffs.filter((s) => s.user_id === userId).map((s) => s.skill_id));
  return skills.filter((s) => !have.has(s.id) && s.requires.every((r) => have.has(r)));
}
