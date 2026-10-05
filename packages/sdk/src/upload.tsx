import { ExternalLink } from 'lucide-react';
import { type ReactNode } from 'react';
import { FileDrop, type FileKind, type ProcessedFile } from '@teamhub/ui';
import { useStorageFull, useToolLink } from './hooks';

// ── Uploads ────────────────────────────────────────────────────────────────
/** FileDrop wired to storage limits and the team's Drive tool link (spec §11.2). */
export function Upload({
  kind,
  onFiles,
  onLink,
  maxFiles,
  maxBytes,
  busy,
  label,
}: {
  kind: FileKind;
  onFiles: (files: ProcessedFile[]) => void | Promise<void>;
  onLink?: (url: string) => void | Promise<void>;
  maxFiles?: number;
  maxBytes?: number;
  busy?: boolean;
  label?: ReactNode;
}) {
  const full = useStorageFull();
  const drive = useToolLink('drive');
  return (
    <FileDrop
      kind={kind}
      onFiles={onFiles}
      onLink={onLink}
      maxFiles={maxFiles}
      maxBytes={maxBytes}
      busy={busy}
      label={label}
      disabledReason={
        full ? (
          <>
            File storage is almost full, so uploads are paused.{' '}
            {drive ? (
              <a className="font-medium text-accent" href={drive.url} target="_blank" rel="noreferrer">
                Put it in {drive.label} <ExternalLink className="inline size-3" aria-hidden />
              </a>
            ) : (
              'Paste a link to the file instead.'
            )}{' '}
            An admin can free space in Admin &gt; Storage.
          </>
        ) : undefined
      }
      driveHint={
        drive ? (
          <>
            Big files and videos belong in{' '}
            <a href={drive.url} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
              {drive.label} <ExternalLink className="inline size-3" aria-hidden />
            </a>
          </>
        ) : undefined
      }
    />
  );
}
