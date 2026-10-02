import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'purchases+inventory',
  requires: ['purchases', 'inventory'],
  prefix: 'ix_purinv_',
  summary: 'Received purchases can be added to the parts inventory in one tap.',
  down: '',
});
