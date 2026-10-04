import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'notebook+manufacture',
  requires: ['notebook', 'manufacture'],
  prefix: 'ix_nbman_',
  summary: '"Add to notebook" on manufacture items creates a pre-filled notebook entry that links back to it.',
  down: '',
});
