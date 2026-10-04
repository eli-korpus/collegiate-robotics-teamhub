import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, testConfig, type TestDb } from './harness';

/** Admin > Who can join: optional email-domain rule for sign-ups, enforced by the database. */
describe('who can join', () => {
  let db: TestDb;
  let admin: string, mentor: string;
  beforeAll(async () => {
    db = await createTestDb();
    await db.applyConfig(testConfig(), true);
    admin = await db.user('Admin', { [TEAM_A]: 'mentor' }, { admin: true });
    mentor = await db.user('Mentor', { [TEAM_A]: 'mentor' });
  }, 120_000);

  const setRules = async (domains: string[], emails: string[] = []) => {
    await db.admin('update teamhub_settings set allowed_email_domains = $1 where id = 1', [domains]);
    await db.admin('delete from teamhub_allowed_emails');
    for (const e of emails) await db.admin('insert into teamhub_allowed_emails (email) values ($1)', [e]);
  };

  it('lets anyone sign up when no domain is set', async () => {
    await setRules([]);
    expect(await db.signUp('anyone@gmail.com', { teams: [TEAM_A] })).toBeTruthy();
  });

  it('only accepts allowed domains (and their subdomains) once a rule is set', async () => {
    await setRules(['collegiateschool.org', 'example.edu']);
    expect(await db.signUp('Student@CollegiateSchool.org', { teams: [TEAM_A] })).toBeTruthy();
    expect(await db.signUp('kid@students.collegiateschool.org')).toBeTruthy();
    expect(await db.signUp('teacher@example.edu')).toBeTruthy();
    await expect(db.signUp('someone@gmail.com', { teams: [TEAM_A] })).rejects.toThrow(/TEAMHUB_EMAIL_NOT_ALLOWED/);
    await expect(db.signUp('trick@notcollegiateschool.org')).rejects.toThrow(/TEAMHUB_EMAIL_NOT_ALLOWED/);
    await expect(db.signUp('trick@collegiateschool.org.evil.com')).rejects.toThrow(/TEAMHUB_EMAIL_NOT_ALLOWED/);
    // A blocked sign-up leaves nothing behind.
    expect(await db.admin(`select 1 from auth.users where email = 'someone@gmail.com'`)).toHaveLength(0);
  });

  it('accepts specific addresses an admin allowed, whatever their domain', async () => {
    await setRules(['collegiateschool.org'], ['coach.smith@gmail.com']);
    expect(await db.signUp('Coach.Smith@gmail.com')).toBeTruthy();
    await expect(db.signUp('coach.jones@gmail.com')).rejects.toThrow(/TEAMHUB_EMAIL_NOT_ALLOWED/);
  });

  it('shows signed-out visitors the domains, but never the allowed addresses', async () => {
    const [r] = await db.as(null, 'select teamhub_join_rules() r');
    expect(r.r).toEqual({ allowed_email_domains: ['collegiateschool.org'] });
    await expect(db.as(null, `select teamhub_email_allowed('coach.smith@gmail.com')`)).rejects.toThrow();
    await expect(db.as(mentor, `select teamhub_email_allowed('coach.smith@gmail.com')`)).rejects.toThrow();
    expect(await db.denied(null, 'select * from teamhub_allowed_emails')).toBe(true);
    expect(await db.denied(mentor, 'select * from teamhub_allowed_emails')).toBe(true);
    expect(await db.as(admin, 'select email from teamhub_allowed_emails')).toEqual([{ email: 'coach.smith@gmail.com' }]);
  });

  it('only admins can change the rule, and only to valid domains', async () => {
    expect(await db.denied(mentor, `update teamhub_settings set allowed_email_domains = '{}' where id = 1`)).toBe(true);
    await db.as(admin, `update teamhub_settings set allowed_email_domains = '{school.org}' where id = 1`);
    await expect(db.as(admin, `update teamhub_settings set allowed_email_domains = '{"@school.org"}' where id = 1`)).rejects.toThrow();
    await expect(db.as(admin, `update teamhub_settings set allowed_email_domains = '{"School.org"}' where id = 1`)).rejects.toThrow();
    await expect(db.as(admin, `insert into teamhub_allowed_emails (email) values ('not an email')`)).rejects.toThrow();
    await expect(db.as(admin, `insert into teamhub_allowed_emails (email) values ('Caps@Gmail.com')`)).rejects.toThrow();
    expect(await db.denied(mentor, `insert into teamhub_allowed_emails (email) values ('x@gmail.com')`)).toBe(true);
  });
});
