import { useNavigate } from 'react-router';
import { NotebookPen } from 'lucide-react';
import { IconButton } from '@teamhub/ui';
import { canWith, useMe, type IntegrationClient } from '@teamhub/sdk';

function AddToNotebook({ run }: { run: { id: string; date: string; score: number | null; notes: string | null; team_id: string | null } }) {
  const nav = useNavigate();
  const me = useMe();
  if (!canWith(me, 'notebook.write', run.team_id)) return null;
  return (
    <IconButton
      label="Add to notebook"
      size="sm"
      onClick={() => nav(`/notebook?new=1&ref=${encodeURIComponent(`driver-practice:run:${run.id}`)}&title=${encodeURIComponent(`Driver practice ${run.date}`)}&body=${encodeURIComponent(`Score: ${run.score ?? '—'}\n\n${run.notes ?? ''}`)}`)}
    >
      <NotebookPen className="size-3.5" />
    </IconButton>
  );
}

const client: IntegrationClient = { id: 'notebook+driver-practice', slots: { 'driver-practice.run.actions': AddToNotebook } };
export default client;
