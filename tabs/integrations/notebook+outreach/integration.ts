import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'notebook+outreach',
  requires: ['notebook', 'outreach'],
  prefix: 'ix_nbout_',
  summary: '“Add to notebook” on outreach events creates a pre-filled notebook entry that links back.',
  down: '',
});
