import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'polls+calendar',
  requires: ['polls', 'calendar'],
  prefix: 'ix_pollcal_',
  summary: 'Ask a poll about a calendar event (“Can you come?”); the event links to its polls.',
  down: '',
});
