import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'competition-day+calendar',
  requires: ['competition-day', 'calendar'],
  prefix: 'ix_compcal_',
  summary: 'A competition on the calendar opens Competition Day for that team and event in one tap.',
  down: '',
});
