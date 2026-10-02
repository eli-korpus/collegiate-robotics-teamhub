import { useNavigate } from 'react-router';
import { NotebookPen } from 'lucide-react';
import { Button } from '@teamhub/ui';
import { canWith, useMe, type IntegrationClient } from '@teamhub/sdk';

function AddToNotebook({ opmode }: { opmode: { id: string; name: string; team_id: string | null } }) {
  const nav = useNavigate();
  const me = useMe();
  if (!canWith(me, 'notebook.write', opmode.team_id)) return null;
  return (
    <Button size="sm" variant="ghost" icon={<NotebookPen className="size-4" />} onClick={() => nav(`/notebook?new=1&ref=${encodeURIComponent(`code-hub:opmode:${opmode.id}`)}&title=${encodeURIComponent(`Software: ${opmode.name}`)}`)}>
      Add to notebook
    </Button>
  );
}

const client: IntegrationClient = { id: 'notebook+code-hub', slots: { 'code-hub.opmode.actions': AddToNotebook } };
export default client;
