import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'notebook+repairs',
  requires: ['notebook', 'repairs'],
  prefix: 'ix_nbrep_',
  summary: '"Add to notebook" on repairs items creates a pre-filled notebook entry that links back to it.',
  down: '',
});
