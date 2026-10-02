import { defineIntegration } from '@teamhub/sdk/define';

export default defineIntegration({
  id: 'signups+calendar',
  requires: ['signups', 'calendar'],
  prefix: 'ix_signcal_',
  summary: 'Attach a sign-up sheet to a calendar event; the event shows its sheets and how full they are.',
  down: '',
});
