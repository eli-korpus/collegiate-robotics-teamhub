import './app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createTeamhubClient, initRuntime, setSupabase } from '@teamhub/sdk';
import { config } from './generated/config';
import { modules } from './generated/modules';
import { integrations, integrationIds } from './generated/integrations';
import { permissions } from './generated/permissions';
import { schemaExpectations } from './generated/schema-expectations';
import { App } from './core/App';
import { NotConfigured } from './core/auth/NotConfigured';

initRuntime({
  config,
  modules,
  integrations,
  integrationIds,
  permissions,
  schema: schemaExpectations,
  basePath: import.meta.env.BASE_URL,
});

const root = createRoot(document.getElementById('root')!);

if (!config.supabase.url || !config.supabase.anonKey) {
  root.render(<NotConfigured />);
} else {
  setSupabase(createTeamhubClient(config.supabase.url, config.supabase.anonKey));
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
