import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'outreach+calendar',
  requires: ['outreach', 'calendar'],
  prefix: 'ix_outcal_',
  summary: 'Outreach events appear on the calendar automatically (read-only overlay — nothing is copied).',
  down: '',
});
