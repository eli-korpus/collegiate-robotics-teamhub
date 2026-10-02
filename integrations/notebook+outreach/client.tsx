import { useNavigate } from 'react-router';
import { NotebookPen } from 'lucide-react';
import { Button } from '@teamhub/ui';
import { canWith, useMe, type IntegrationClient } from '@teamhub/sdk';

function AddToNotebook({ event }: { event: { id: string; title: string; team_id: string | null; people_reached: number | null; kind: string } }) {
  const nav = useNavigate();
  const me = useMe();
  if (!canWith(me, 'notebook.write', event.team_id)) return null;
  const body = `**${event.kind}**${event.people_reached != null ? ` · ${event.people_reached} people reached` : ''}\n\nWhat we did:\n\nWhat we learned:\n`;
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={<NotebookPen className="size-4" />}
      onClick={() => nav(`/notebook?new=1&ref=${encodeURIComponent('outreach:event:' + event.id)}&title=${encodeURIComponent('Outreach: ' + event.title)}&body=${encodeURIComponent(body)}`)}
    >
      Add to notebook
    </Button>
  );
}

const client: IntegrationClient = { id: 'notebook+outreach', slots: { 'outreach.event.actions': AddToNotebook } };
export default client;
