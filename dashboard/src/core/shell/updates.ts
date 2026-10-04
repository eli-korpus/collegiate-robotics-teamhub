import { useQuery } from '@tanstack/react-query';
import { TEAMHUB_UPSTREAM_REPO, isMajorUpgrade, isNewerVersion, isSecurityRelease } from '@teamhub/config-schema/util';
import { runtime, useSession } from '@teamhub/sdk';

export interface LatestRelease {
  version: string;
  title: string;
  url: string;
  security: boolean;
  major: boolean;
}

const CACHE_KEY = 'teamhub-latest-release';
const DAY = 24 * 60 * 60 * 1000;

/**
 * The newest TeamHub release on GitHub, if it's newer than this site. Only admins' browsers ask (at most once a day,
 * no account or key needed); everyone else never contacts GitHub. Failures are silent: this is a convenience.
 */
export function useAvailableUpdate(): LatestRelease | null {
  const { me } = useSession();
  const current = runtime().config.version;
  const q = useQuery({
    queryKey: ['core', 'latest-release'],
    enabled: !!me?.isAdmin,
    staleTime: DAY,
    retry: false,
    queryFn: async (): Promise<LatestRelease | null> => {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as { at: number; release: Omit<LatestRelease, 'major'> | null } | null;
        if (cached && Date.now() - cached.at < DAY) return cached.release ? { ...cached.release, major: false } : null;
      } catch {}
      const res = await fetch(`https://api.github.com/repos/${TEAMHUB_UPSTREAM_REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) return null;
      const r = (await res.json()) as { tag_name?: string; name?: string; html_url?: string };
      const version = (r.tag_name ?? '').replace(/^v/, '');
      // Only ever link to the release page on github.com.
      const url = r.html_url?.startsWith(`https://github.com/${TEAMHUB_UPSTREAM_REPO}/`) ? r.html_url : `https://github.com/${TEAMHUB_UPSTREAM_REPO}/releases`;
      const release = version ? { version, title: r.name || `TeamHub v${version}`, url, security: isSecurityRelease(r.name) } : null;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), release }));
      } catch {}
      return release ? { ...release, major: false } : null;
    },
  });
  const r = q.data;
  if (!r || !isNewerVersion(r.version, current)) return null;
  return { ...r, major: isMajorUpgrade(current, r.version) };
}
