import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'manufacture+inventory',
  requires: ['manufacture', 'inventory'],
  prefix: 'ix_mfginv_',
  summary: 'Finished parts can be added to the parts inventory.',
  down: '',
});
