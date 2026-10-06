import { ExternalLink } from 'lucide-react';
import { Banner, safeHref } from '@teamhub/ui';
import { runtime } from '@teamhub/sdk';
import { useAvailableUpdate } from '../shell/updates';

/** "TeamHub 1.3 is available" for admins, with how to update (docs/updating.md). */
export function UpdateNotice() {
  const u = useAvailableUpdate();
  if (!u) return null;
  return (
    <Banner
      tone={u.security ? 'danger' : 'info'}
      className="mb-5"
      title={u.security ? `Security update available: TeamHub ${u.version}` : `TeamHub ${u.version} is available`}
    >
      <p>
        This site runs {runtime().config.version}.{u.security ? ' This release fixes a security problem, so update as soon as you can.' : ''}
        {u.major ? ' It’s a major update: read the upgrade guide in the release notes first.' : ''}
      </p>
      <p className="mt-1">
        To update, run <code>npm run setup</code> on your computer and choose <strong>Update</strong>. It backs up your data, updates your database, then your site.{' '}
        <a href={safeHref(u.url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
          What’s new <ExternalLink className="size-3" aria-hidden />
        </a>
      </p>
    </Banner>
  );
}
