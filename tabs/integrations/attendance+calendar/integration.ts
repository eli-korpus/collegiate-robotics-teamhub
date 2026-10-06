import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'attendance+calendar',
  requires: ['attendance', 'calendar'],
  prefix: 'ix_attcal_',
  summary: 'Attendance is taken for events on the calendar: every practice, meeting or event gets a "Take attendance" button, and the Attendance tab picks from the calendar instead of creating separate practices.',
  down: `alter table att_sessions drop column if exists calendar_event_id;
alter table att_sessions drop column if exists occurrence_date;`,
});
