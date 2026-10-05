import { describe, expect, it } from 'vitest';
import { emailDomainAllowed, normalizeEmailDomain, parseConfig } from '@teamhub/config-schema';
import { joinRulesSql } from './provision';

const config = (domains: string[]) => {
  const r = parseConfig({ program: { name: 'Test' }, teams: [{ id: '11111111-1111-4111-8111-111111111111', number: null, name: 'A', shortCode: 'A', color: '#3B82F6' }], season: '2026–27', join: { allowedEmailDomains: domains } });
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.config;
};

describe('who can join', () => {
  it('cleans up what people type', () => {
    expect(normalizeEmailDomain(' @Example.edu ')).toBe('example.edu');
    expect(normalizeEmailDomain('jane@example.edu')).toBe('example.edu');
    expect(normalizeEmailDomain('https://www.school.org/')).toBe('school.org');
    expect(normalizeEmailDomain('not a domain')).toBeNull();
    expect(normalizeEmailDomain('localhost')).toBeNull();
  });

  it('matches the database rule', () => {
    expect(emailDomainAllowed('a@gmail.com', [])).toBe(true);
    expect(emailDomainAllowed('a@students.school.org', ['school.org'])).toBe(true);
    expect(emailDomainAllowed('a@notschool.org', ['school.org'])).toBe(false);
  });

  it('only writes the rule when the wizard’s own list changed', () => {
    expect(joinRulesSql(config(['school.org']), null)).toContain(`array['school.org']::text[]`);
    expect(joinRulesSql(config(['school.org']), JSON.stringify(['school.org']))).toBeNull();
    expect(joinRulesSql(config([]), JSON.stringify(['school.org']))).toContain('array[]::text[]');
  });

  it('rejects invalid domains in the config', () => {
    expect(parseConfig({ program: { name: 'T' }, teams: [{ id: '11111111-1111-4111-8111-111111111111', number: null, name: 'A', shortCode: 'A', color: '#3B82F6' }], season: '2026–27', join: { allowedEmailDomains: ['@School.org'] } }).ok).toBe(false);
  });
});
