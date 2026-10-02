import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'notebook+driver-practice',
  requires: ['notebook', 'driver-practice'],
  prefix: 'ix_nbdriver_',
  summary: '"Add to notebook" on driver-practice items creates a pre-filled notebook entry that links back to it.',
  down: '',
});
