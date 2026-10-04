import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'events+calendar',
  requires: ['events', 'calendar'],
  prefix: 'ix_evtcal_',
  summary: 'Your FTCScout competitions appear on the calendar automatically (merged with any calendar event that has the same event code).',
  down: '',
});
