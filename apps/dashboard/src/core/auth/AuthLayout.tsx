import type { ReactNode } from 'react';
import { runtime } from '@teamhub/sdk';
import { cn } from '@teamhub/ui';

export function asset(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^(https?:|data:)/.test(path)) return path;
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

export function ProgramLogo({ size = 40, className }: { size?: number; className?: string }) {
  const c = runtime().config;
  const src = asset(c.program.logo ?? c.teams[0]?.logo ?? null);
  if (!src)
    return (
      <span className={cn('grid place-items-center rounded-lg bg-accent font-bold text-accent-fg', className)} style={{ width: size, height: size, fontSize: size * 0.42 }}>
        {c.program.name.slice(0, 1).toUpperCase()}
      </span>
    );
  return <img src={src} alt="" width={size} height={size} className={cn('rounded-lg object-contain dark:bg-white/90 dark:p-0.5', className)} style={{ width: size, height: size }} />;
}

export function TeamLogo({ teamId, size = 32, className }: { teamId: string; size?: number; className?: string }) {
  const t = runtime().config.teams.find((x) => x.id === teamId);
  if (!t) return null;
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const src = asset(isDark && t.logoDark ? t.logoDark : t.logo);
  if (!src)
    return (
      <span className={cn('grid shrink-0 place-items-center rounded-md text-[11px] font-bold text-white', className)} style={{ width: size, height: size, background: t.color }}>
        {t.shortCode}
      </span>
    );
  return (
    <img
      src={src}
      alt={`${t.name} logo`}
      className={cn('shrink-0 rounded-md object-contain', !t.logoDark && 'dark:bg-white/90 dark:p-0.5', className)}
      style={{ width: size, height: size }}
    />
  );
}

/** Centered card for login / join / pending (calm, Spark-like). */
export function AuthLayout({ title, subtitle, children, wide }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  const c = runtime().config;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-10">
      <div className={cn('w-full', wide ? 'max-w-xl' : 'max-w-sm')}>
        <div className="mb-6 flex flex-col items-center text-center">
          <ProgramLogo size={52} />
          <p className="mt-3 text-[13px] font-medium text-muted">{c.program.name}</p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-[13.5px] text-muted">{subtitle}</p>}
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-6">{children}</div>
        <p className="mt-6 text-center text-[11.5px] text-faint">
          Powered by{' '}
          <a href="https://github.com/elikorpus/teamhub-ftc" className="hover:underline" target="_blank" rel="noreferrer">
            TeamHub FTC
          </a>
        </p>
      </div>
    </div>
  );
}
