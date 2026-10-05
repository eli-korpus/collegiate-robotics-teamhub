import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, TEAM_B, testConfig, type TestDb } from './harness';

/** Positions are either for the whole program or "each team has its own" (per_team). */
describe('positions: whole program or each team', () => {
  let db: TestDb;
  let admin: string, mentorA: string, mentorB: string, memberA: string, memberB: string, memberBoth: string;
  const holder = async (pos: string, user: string) => (await db.admin<{ team_id: string | null }>('select team_id from position_holders where position_id = $1 and user_id = $2', [pos, user]))[0];
  const has = async (user: string, team: string | null, pos: string) =>
    (await db.as(user, 'select teamhub_has_position($1, $2) ok', [team, [pos]]))[0].ok as boolean;

  beforeAll(async () => {
    db = await createTestDb();
    await db.applyConfig(
      testConfig({
        positions: [
          { id: 'pos_build_lead', name: 'Build Lead', perTeam: true, grantsPermissions: true },
          { id: 'pos_outreach_lead', name: 'Outreach Lead', grantsPermissions: true },
        ],
      }),
      true,
    );
    admin = await db.user('Admin', { [TEAM_A]: 'mentor' }, { admin: true });
    mentorA = await db.user('MentorA', { [TEAM_A]: 'mentor' });
    mentorB = await db.user('MentorB', { [TEAM_B]: 'mentor' });
    memberA = await db.user('MemberA', { [TEAM_A]: 'member' });
    memberB = await db.user('MemberB', { [TEAM_B]: 'member' });
    memberBoth = await db.user('MemberBoth', { [TEAM_A]: 'member', [TEAM_B]: 'member' });
  }, 120_000);

  it('the setup config marks per-team positions', async () => {
    expect(await db.admin('select id, per_team from positions order by id')).toEqual([
      { id: 'pos_build_lead', per_team: true },
      { id: 'pos_outreach_lead', per_team: false },
    ]);
  });

  it('each team can have its own holder of the same position, who only acts for that team', async () => {
    await db.as(mentorA, `select people_assign_positions_in_team($1, '{pos_build_lead}', $2)`, [memberA, TEAM_A]);
    await db.as(mentorB, `select people_assign_positions_in_team($1, '{pos_build_lead}', $2)`, [memberB, TEAM_B]);
    expect((await holder('pos_build_lead', memberA)).team_id).toBe(TEAM_A);
    expect((await holder('pos_build_lead', memberB)).team_id).toBe(TEAM_B);
    expect(await has(memberA, TEAM_A, 'pos_build_lead')).toBe(true);
    expect(await has(memberA, TEAM_B, 'pos_build_lead')).toBe(false);
    expect(await has(memberB, TEAM_B, 'pos_build_lead')).toBe(true);
  });

  it('a mentor can only assign it for their own team, and only to people on that team', async () => {
    await expect(db.as(mentorA, `select people_assign_positions_in_team($1, '{pos_build_lead}', $2)`, [memberBoth, TEAM_B])).rejects.toThrow(/Not allowed/);
    await expect(db.as(admin, `select people_assign_positions_in_team($1, '{pos_build_lead}', $2)`, [memberA, TEAM_B])).rejects.toThrow(/another team/);
    expect(await db.denied(mentorA, `delete from position_holders where position_id = 'pos_build_lead' and user_id = $1`, [memberB])).toBe(true);
  });

  it('needs a team for people on several teams, and picks the only team otherwise', async () => {
    await expect(db.as(admin, `select people_assign_positions($1, '{pos_build_lead}')`, [memberBoth])).rejects.toThrow(/Pick which team/);
    const solo = await db.user('Solo', { [TEAM_B]: 'member' });
    await db.as(admin, `select people_assign_positions($1, '{pos_build_lead}')`, [solo]);
    expect((await holder('pos_build_lead', solo)).team_id).toBe(TEAM_B);
  });

  it("won't silently move someone's position to another team", async () => {
    await db.as(admin, `select people_assign_positions_in_team($1, '{pos_build_lead}', $2)`, [memberBoth, TEAM_A]);
    await expect(db.as(admin, `select people_assign_positions_in_team($1, '{pos_build_lead}', $2)`, [memberBoth, TEAM_B])).rejects.toThrow(/another team/);
  });

  it('whole-program positions still work everywhere', async () => {
    await db.as(admin, `select people_assign_positions($1, '{pos_outreach_lead}')`, [memberBoth]);
    expect((await holder('pos_outreach_lead', memberBoth)).team_id).toBeNull();
    expect(await has(memberBoth, TEAM_A, 'pos_outreach_lead')).toBe(true);
    expect(await has(memberBoth, TEAM_B, 'pos_outreach_lead')).toBe(true);
  });

  it('approving someone with a per-team position gives it for the team they join', async () => {
    const id = await db.signUp('newbie@test.dev', { name: 'Newbie', teams: [TEAM_B] });
    await db.as(mentorB, `select people_approve($1, $2, 'member', '{pos_build_lead}')`, [id, TEAM_B]);
    expect((await holder('pos_build_lead', id)).team_id).toBe(TEAM_B);
  });
});
