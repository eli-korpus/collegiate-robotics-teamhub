import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'attendance+calendar',
  requires: ['attendance', 'calendar'],
  prefix: 'ix_attcal_',
  summary: 'Practices on the calendar get a one-tap "Take attendance" button, and sessions remember which event they belong to.',
  down: `alter table att_sessions drop column if exists calendar_event_id;
alter table att_sessions drop column if exists occurrence_date;`,
});
