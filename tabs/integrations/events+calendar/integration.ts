import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'events+calendar',
  requires: ['events', 'calendar'],
  prefix: 'ix_evtcal_',
  summary: 'Your FTCScout competitions appear on the calendar automatically (merged with the calendar event for the same team and event), and calendar competitions link to their results.',
  down: '',
});
