import { z } from 'zod';
import { defineModule, definePermissions } from '@teamhub/sdk/define';

export const permissions = definePermissions('scouting', {
  scout: { label: 'Scout matches and pits', default: ['member', 'captain', 'mentor'] },
  manage_template: { label: 'Build the scouting forms', default: ['captain', 'mentor'], positions: ['pos_scouting_lead'], simple: true },
  manage_picklist: { label: 'Edit the pick list', default: ['captain', 'mentor'], positions: ['pos_scouting_lead'] },
  delete_entries: { label: 'Delete scouting entries', default: ['captain', 'mentor'] },
});

export default defineModule({
  id: 'scouting',
  prefix: 'sct_',
  name: 'Scouting',
  category: 'competition',
  icon: 'ScanSearch',
  summary: 'Scout other teams with your own forms, compare them and build a pick list.',
  purpose: 'Scout other teams and build a pick list.',
  notFor: [{ text: 'Our own practice data', goTo: 'driver-practice' }],
  footprint: '~1–3 MB per season (old seasons can be cleared)',
  stores: "Your season's match/pit forms, every scouting entry, and pick lists per event.",
  settings: z.object({}),
  permissions,
  suggestedPositions: ['Scouting Lead'],
  entities: ['entry'],
  buckets: [],
  toolLinkSlots: ['scouting_sheet', 'ftcscout'],
  widgets: [],
  exportTables: ['sct_templates', 'sct_events', 'sct_entries', 'sct_picklist'],
  seasonRollover: {
    describe: "Copies last season's forms into the new season. Old entries stay until you delete them (export first).",
    sql: "insert into sct_templates (kind, season, fields, version) select kind, :new, fields, 1 from sct_templates where season = :old on conflict (kind, season) do nothing;",
  },
});
