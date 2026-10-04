/**
 * Scaffolds a new tab module (see CONTRIBUTING.md → "How to write a module").
 *
 *   npm run new-module -- robot-log --prefix rlog_ --name "Robot Log" --category engineering
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MODULE_CATEGORIES } from '@teamhub/config-schema';
import { loadCatalog, REPO_ROOT } from '@teamhub/generator';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const id = process.argv[2];
const fail = (msg: string): never => {
  console.error(`Error: ${msg}`);
  process.exit(1);
};

if (!id || id.startsWith('--') || !/^[a-z][a-z0-9-]*$/.test(id)) fail('Usage: npm run new-module -- <id> --prefix <abc_> --name "Tab name" --category team|engineering|competition|outreach');
const prefix = arg('prefix') ?? `${id.replace(/[^a-z]/g, '').slice(0, 4)}_`;
const name = arg('name') ?? id.replace(/(^|-)(\w)/g, (_, s, c) => (s ? ' ' : '') + c.toUpperCase());
const category = arg('category') ?? 'team';
if (!/^[a-z]+_$/.test(prefix)) fail(`Prefix must look like "abc_" (got "${prefix}")`);
if (!(MODULE_CATEGORIES as readonly string[]).includes(category)) fail(`Category must be one of ${MODULE_CATEGORIES.join(', ')}`);
const dir = join(REPO_ROOT, 'tabs', id);
if (existsSync(dir)) fail(`tabs/${id} already exists`);
const catalog = await loadCatalog();
for (const [other, m] of catalog.modules) if (m.manifest.prefix === prefix) fail(`Prefix ${prefix} is already used by ${other}`);

const pascal = name.replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toUpperCase());
const table = `${prefix}items`;
const files: Record<string, string> = {
  'module.ts': `import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('${id}', {
  create: { label: 'Add items', default: ['member', 'captain', 'mentor'], simple: true },
  manage: { label: "Edit and delete anyone's items", default: ['mentor'] },
});

export default defineModule({
  id: '${id}',
  prefix: '${prefix}',
  name: '${name}',
  category: '${category}',
  icon: 'Box',
  summary: 'TODO: one sentence shown in the wizard and the page header.',
  purpose: 'TODO: the single job this tab does.',
  // Point people to the right place for things this tab deliberately doesn't do (spec §13.0).
  notFor: [{ text: 'General to-dos', goTo: 'tasks' }],
  footprint: 'Tiny',
  stores: 'TODO: what rows this tab keeps.',
  settings: z.object({}),
  permissions,
  suggestedPositions: [],
  entities: ['item'],
  buckets: [],
  toolLinkSlots: [],
  widgets: [],
  exportTables: ['${table}'],
});
`,
  'migrations/001_init.sql': `-- ${name}. Migrations are expand-only: add tables/columns, never drop or rename (npm run lint checks).
create table ${table} (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
`,
  'policies.sql': `-- Re-applied on every plan. Every object must start with ${prefix}.
alter table ${table} enable row level security;
create policy ${prefix}items_read on ${table} for select to authenticated using (teamhub_in_team(team_id));
create policy ${prefix}items_insert on ${table} for insert to authenticated with check (teamhub_can('${id}.create', team_id) and created_by = (select auth.uid()));
create policy ${prefix}items_change on ${table} for update to authenticated
  using (created_by = (select auth.uid()) or teamhub_can('${id}.manage', team_id)) with check (teamhub_in_team(team_id));
create policy ${prefix}items_delete on ${table} for delete to authenticated using (created_by = (select auth.uid()) or teamhub_can('${id}.manage', team_id));
`,
  'client.tsx': `import { lazy } from 'react';
import { Box } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

// The marker string lets the bundle check prove disabled tabs contribute 0 bytes.
export default defineClient('teamhub-module:${id}', {
  icon: Box,
  Routes: lazy(() => import('./ui/Routes')),
});
`,
  'ui/Routes.tsx': `import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Box, Plus } from 'lucide-react';
import { Button, EmptyState, Input, Spinner, toast } from '@teamhub/ui';
import { friendlyError, ModuleHeader, ModulePurpose, useCan, useMe, useRows, useSupabase, useTeamScope } from '@teamhub/sdk';

interface Item {
  id: string;
  team_id: string | null;
  title: string;
}

export default function ${pascal}Routes() {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const scope = useTeamScope();
  const canCreate = useCan('${id}.create');
  const items = useRows<Item>(['${id}', 'items'], (s) => s.from('${table}').select('*').order('created_at', { ascending: false }));
  const [title, setTitle] = useState('');
  const add = async () => {
    const { error } = await sb.from('${table}').insert({ title: title.trim(), team_id: scope, created_by: me.id });
    if (error) return toast.error(friendlyError(error));
    setTitle('');
    qc.invalidateQueries({ queryKey: ['${id}'] });
  };
  return (
    <div>
      <ModuleHeader moduleId="${id}" />
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 sm:px-6">
        {canCreate && (
          <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), title.trim() && add())}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New item…" maxLength={160} />
            <Button type="submit" variant="primary" icon={<Plus className="size-4" />}>
              Add
            </Button>
          </form>
        )}
        {items.isLoading ? (
          <Spinner />
        ) : !items.data?.length ? (
          <EmptyState icon={<Box />} title="Nothing here yet" body={<ModulePurpose moduleId="${id}" compact className="mt-2 text-left" />} />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {items.data.map((i) => (
              <li key={i.id} className="px-4 py-2.5 text-[13.5px]">
                {i.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
`,
  'README.md': `# ${name}

**Purpose:** TODO.

**Not for:** TODO (and where to go instead).

**Permissions:** create (everyone), manage (Mentors).
`,
  [`${id}.test.ts`]: `import { describe, expect, it } from 'vitest';
import { createTestDb, TEAM_A, TEAM_B, withModules } from '../../tools/tests/db/harness';

describe('${id}', () => {
  it('members add their own items; other teams cannot see them', async () => {
    const db = await createTestDb();
    await db.applyConfig(withModules(['${id}']), true);
    const a = await db.user('A', { [TEAM_A]: 'member' });
    const b = await db.user('B', { [TEAM_B]: 'member' });
    await db.as(a, \`insert into ${table} (team_id, title, created_by) values ($1, 'Hello', $2)\`, [TEAM_A, a]);
    expect((await db.as(a, 'select * from ${table}')).length).toBe(1);
    expect((await db.as(b, 'select * from ${table}')).length).toBe(0);
  });
});
`,
};

for (const [rel, content] of Object.entries(files)) {
  const path = join(dir, rel);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
}
console.log(`Created tabs/${id} (prefix ${prefix})
Next:
  1. Fill in the TODOs in tabs/${id}/module.ts and README.md
  2. Enable it in a config (e.g. tools/examples/demo.config.json) and run: npm run dev:demo
  3. npm run lint && npm test -- tabs/${id}`);
