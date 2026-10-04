import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'repairs+inventory',
  requires: ['repairs', 'inventory'],
  prefix: 'ix_repinv_',
  summary: 'Record which parts a repair used; they are taken out of inventory.',
  down: 'drop table if exists ix_repinv_parts;',
});
