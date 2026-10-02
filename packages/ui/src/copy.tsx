import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from './primitives';
import { cn } from './cn';

/** Read-only text with a copy button (invite messages, the AI assistant prompt). */
export function CopyBlock({ text, label, rows = 8, className }: { text: string; label: string; rows?: number; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={cn('space-y-2', className)}>
      <textarea
        readOnly
        aria-label={label}
        value={text}
        rows={rows}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full resize-y rounded-md border border-border bg-bg-subtle/60 p-3 font-mono text-[12px] leading-relaxed text-fg"
      />
      <Button
        icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? 'Copied' : `Copy ${label.toLowerCase()}`}
      </Button>
    </div>
  );
}
