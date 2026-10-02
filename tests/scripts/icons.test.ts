import { describe, expect, it } from 'vitest';
import { icons } from 'lucide-react';
import { loadCatalog } from '../../packages/generator/src/catalog';

describe('module icons', () => {
  it('every manifest icon is a Lucide icon name the wizard can look up', async () => {
    const c = await loadCatalog();
    const missing = [...c.modules.values()].map((m) => m.manifest.icon).filter((name) => !(name in icons));
    expect(missing).toEqual([]);
  });
});
