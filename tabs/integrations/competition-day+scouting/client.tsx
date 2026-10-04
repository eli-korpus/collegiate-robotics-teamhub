import { useNavigate } from 'react-router';
import { ScanSearch } from 'lucide-react';
import { Button } from '@teamhub/ui';
import { matchLabel, type FtcMatch, type IntegrationClient } from '@teamhub/sdk';

function ScoutThisMatch({ match, eventCode }: { match: FtcMatch; eventCode: string }) {
  const nav = useNavigate();
  return (
    <>
      <Button
        size="sm"
        icon={<ScanSearch className="size-4" />}
        onClick={() => {
          try {
            localStorage.setItem('teamhub-scouting-event', JSON.stringify(eventCode));
            localStorage.setItem('teamhub-scouting-tab', JSON.stringify('scout'));
            localStorage.setItem(`teamhub-scout-draft:${eventCode}:match`, JSON.stringify({ team: '', match: matchLabel(match), values: {} }));
          } catch {}
          nav('/scouting');
        }}
      >
        Scout {matchLabel(match)}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          try {
            localStorage.setItem('teamhub-scouting-event', JSON.stringify(eventCode));
            localStorage.setItem('teamhub-scouting-tab', JSON.stringify('insights'));
          } catch {}
          nav('/scouting');
        }}
      >
        Scouting insights
      </Button>
    </>
  );
}

const client: IntegrationClient = { id: 'competition-day+scouting', slots: { 'competition-day.match': ScoutThisMatch } };
export default client;
