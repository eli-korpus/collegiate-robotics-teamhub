import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'judging+checklists',
  requires: ['judging', 'checklists'],
  prefix: 'ix_jdgchk_',
  summary: 'Judging Prep shows shortcuts to your judging/pit and portfolio checklists.',
  down: '',
});
