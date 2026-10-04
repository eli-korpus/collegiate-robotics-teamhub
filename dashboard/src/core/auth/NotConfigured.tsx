/** Shown when the build has no Supabase URL/key (config not finished). Uses plain markup: no runtime needed. */
export function NotConfigured() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-6">
      <div className="max-w-md rounded-lg border border-border bg-surface p-6 text-[14px] shadow-sm">
        <h1 className="text-[18px] font-semibold">TeamHub isn't connected yet</h1>
        <p className="mt-2 text-muted">
          This site was built without a Supabase project. On your computer, run <code className="rounded bg-bg-subtle px-1">npm run setup</code> and finish the
          “Connect Supabase” step, then publish again.
        </p>
      </div>
    </div>
  );
}
