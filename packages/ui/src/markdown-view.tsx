import { useMemo } from 'react';
import { cn } from './cn';
import { renderMarkdown } from './markdown';

export function Markdown({ source, className }: { source: string; className?: string }) {
  // renderMarkdown escapes all HTML before formatting, so this is safe.
  const html = useMemo(() => renderMarkdown(source), [source]);
  return <div className={cn('th-prose break-words text-[14px] leading-relaxed', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
