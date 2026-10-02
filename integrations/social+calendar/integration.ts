import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'social+calendar',
  requires: ['social', 'calendar'],
  prefix: 'ix_soccal_',
  summary: 'Scheduled social posts appear on the calendar (read-only overlay).',
  down: '',
});
