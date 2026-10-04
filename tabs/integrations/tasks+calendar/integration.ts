import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'tasks+calendar',
  requires: ['tasks', 'calendar'],
  prefix: 'ix_taskcal_',
  summary: 'Task due dates appear on the calendar (read-only overlay; nothing is copied).',
  down: '',
});
