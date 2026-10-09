import { beforeAll, describe, expect, it } from 'vitest';
import { resolveSlotLinks, type LinkRow } from './hooks';
import { initRuntime } from './runtime';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const link = (slot: string, team_id: string | null, label: string): LinkRow =>
  ({ id: `${slot}-${team_id}`, slot, team_id, label, url: `https://example.org/${label}`, description: null, section: null, sort: 0, created_by: null }) as LinkRow;

describe('which tool link to show', () => {
  beforeAll(() => {
    initRuntime({ config: { program: { name: 'Example Robotics', multiTeam: true }, teams: [{ id: A, shortCode: 'A' }, { id: B, shortCode: 'B' }] } } as never);
  });

  const links = [link('code_repo', A, 'Code'), link('code_repo', B, 'Code'), link('team_chat', null, 'Chat'), link('cad', A, 'CAD A'), link('cad', null, 'CAD')];

  it("viewing one team shows that team's own link, else the program-wide one", () => {
    expect(resolveSlotLinks(links, ['code_repo', 'team_chat', 'cad'], A).map((l) => l.id)).toEqual(['code_repo-' + A, 'team_chat-null', 'cad-' + A]);
    expect(resolveSlotLinks(links, ['cad'], B).map((l) => l.id)).toEqual(['cad-null']);
  });

  it('viewing all teams shows the program-wide link, else each team’s link labelled with the team', () => {
    expect(resolveSlotLinks(links, ['cad'], null).map((l) => l.label)).toEqual(['CAD']);
    expect(resolveSlotLinks(links, ['code_repo'], null).map((l) => l.label)).toEqual(['Code (A)', 'Code (B)']);
  });

  it("never shows another team's link", () => {
    expect(resolveSlotLinks([link('portfolio', B, 'Folio')], ['portfolio'], A)).toEqual([]);
  });

  it('shows every "Other" link: the program\'s plus the viewed team\'s own', () => {
    const others = [link('other', null, 'Fundraiser'), link('other', null, 'Robot shop'), link('other', A, 'Sign-in sheet'), link('other', B, 'Carpool')];
    expect(resolveSlotLinks(others, ['other'], A).map((l) => l.label)).toEqual(['Fundraiser', 'Robot shop', 'Sign-in sheet']);
    expect(resolveSlotLinks(others, ['other'], null).map((l) => l.label)).toEqual(['Fundraiser', 'Robot shop', 'Sign-in sheet (A)', 'Carpool (B)']);
  });
});

describe('team labels on links', () => {
  beforeAll(() => {
    initRuntime({ config: { program: { name: 'Example Robotics', multiTeam: true }, teams: [{ id: A, shortCode: 'A', number: 12345, name: 'Gearheads' }, { id: B, shortCode: 'B', number: 67890, name: 'Sparks' }] } } as never);
  });
  it("doesn't repeat the team when the label already names it", () => {
    const ls = [link('portfolio', A, 'Portfolio (12345)'), link('portfolio', B, 'Sparks portfolio'), link('cad', A, 'CAD'), link('cad', B, 'CAD')];
    expect(resolveSlotLinks(ls, ['portfolio', 'cad'], null).map((l) => l.label)).toEqual(['Portfolio (12345)', 'Sparks portfolio', 'CAD (A)', 'CAD (B)']);
    expect(resolveSlotLinks([link('drive', A, 'Get a quote'), link('drive', B, 'Drive')], ['drive'], null).map((l) => l.label)).toEqual(['Get a quote (A)', 'Drive (B)']);
  });
});
