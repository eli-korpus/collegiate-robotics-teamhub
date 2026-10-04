import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'competition-day+checklists',
  requires: ['competition-day', 'checklists'],
  prefix: 'ix_compchk_',
  summary: 'Competition Day shows your robot/pit checklists with today’s progress.',
  down: '',
});
