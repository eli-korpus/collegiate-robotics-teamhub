import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'competition-day+scouting',
  requires: ['competition-day', 'scouting'],
  prefix: 'ix_compsct_',
  summary: '“Scout this match” on Competition Day opens Scouting on the right event and match; partners show your scouting.',
  down: '',
});
