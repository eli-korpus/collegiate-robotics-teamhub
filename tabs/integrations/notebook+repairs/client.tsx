import { useNavigate } from 'react-router';
import { NotebookPen } from 'lucide-react';
import { Button } from '@teamhub/ui';
import { canWith, useMe, type IntegrationClient } from '@teamhub/sdk';

function AddToNotebook({ issue }: { issue: { id: string; title: string; team_id: string | null } }) {
  const nav = useNavigate();
  const me = useMe();
  if (!canWith(me, 'notebook.write', issue.team_id)) return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={<NotebookPen className="size-4" />}
      onClick={() => nav(`/notebook?new=1&ref=${encodeURIComponent('repairs:issue:' + issue.id)}&title=${encodeURIComponent('Repair: ' + issue.title)}`)}
    >
      Add to notebook
    </Button>
  );
}

const client: IntegrationClient = { id: 'notebook+repairs', slots: { 'repairs.issue.actions': AddToNotebook } };
export default client;
