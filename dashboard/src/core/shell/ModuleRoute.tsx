import { Suspense } from 'react';
import { Spinner } from '@teamhub/ui';
import { useSchemaStatus, type LoadedModule } from '@teamhub/sdk';
import { DbBehind } from './Shell';

/** Mounts a module's lazy routes at /<id>/*, unless the DB is behind (graceful degradation, spec §5.7). */
export function ModuleRoute({ module: m }: { module: LoadedModule }) {
  const schema = useSchemaStatus();
  const st = schema.status(m.manifest.id);
  if (st === 'behind' || st === 'missing') return <DbBehind name={m.manifest.name} />;
  const R = m.client.Routes;
  return (
    <Suspense
      fallback={
        <div className="grid h-64 place-items-center">
          <Spinner />
        </div>
      }
    >
      <R />
    </Suspense>
  );
}
