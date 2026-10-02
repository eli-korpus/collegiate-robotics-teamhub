import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'notebook+code-hub',
  requires: ['notebook', 'code-hub'],
  prefix: 'ix_nbcodehu_',
  summary: '"Add to notebook" on code-hub items creates a pre-filled notebook entry that links back to it.',
  down: '',
});
