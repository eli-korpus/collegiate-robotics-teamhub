import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Info } from 'lucide-react';
import { IconButton, PageHeader, Popover } from '@teamhub/ui';
import { getModule } from './runtime';
import { ModulePurpose } from './purpose';
import { ToolLinks } from './toollinks';

/**
 * Wraps a module's client definition. The marker string lets CI prove disabled modules contribute 0 bytes
 * (spec §16.4): every client file passes `'teamhub-module:<id>'` literally.
 */
/** Standard tab header: icon, name, tool-link chips for the module's slots, purpose popover and actions. */
export function ModuleHeader({
  moduleId,
  actions,
  children,
  subtitle,
  title,
}: {
  moduleId: string;
  actions?: ReactNode;
  children?: ReactNode;
  subtitle?: ReactNode;
  title?: ReactNode;
}) {
  const m = getModule(moduleId);
  if (!m) return null;
  const Icon = m.client.icon;
  return (
    <PageHeader
      title={title ?? m.manifest.name}
      icon={<Icon />}
      subtitle={subtitle ?? m.manifest.summary}
      actions={
        <>
          <Popover
            align="end"
            className="w-80 p-0"
            trigger={
              <IconButton label={`What is ${m.manifest.name} for?`} size="sm">
                <Info className="size-4" />
              </IconButton>
            }
          >
            <ModulePurpose moduleId={moduleId} className="border-0" />
          </Popover>
          {actions}
        </>
      }
    >
      {(m.manifest.toolLinkSlots.length > 0 || children) && (
        // Below desktop width a tab's own toolbar row may shrink to the screen so its controls wrap.
        <div className="flex flex-wrap items-center gap-2 max-lg:[&>*]:min-w-0">
          <ToolLinks slots={m.manifest.toolLinkSlots} />
          {children}
        </div>
      )}
    </PageHeader>
  );
}

/** `?new=1` (from ⌘K / NewMenu shortcuts) opens a composer; returns [open, setOpen] and the other params. */
export function useNewParam(): [boolean, (v: boolean) => void, URLSearchParams] {
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get('new') === '1');
  useEffect(() => {
    if (params.get('new') === '1') setOpen(true);
  }, [params]);
  return [
    open,
    (v: boolean) => {
      setOpen(v);
      if (!v && params.get('new')) {
        const next = new URLSearchParams(params);
        next.delete('new');
        setParams(next, { replace: true });
      }
    },
    params,
  ];
}

/** Selected item id kept in the URL (`?item=…`) so details are linkable from entity refs and notifications. */
export function useSelectedParam(key = 'item'): [string | null, (id: string | null) => void] {
  const [params, setParams] = useSearchParams();
  return [
    params.get(key),
    (id) => {
      const next = new URLSearchParams(params);
      if (id) next.set(key, id);
      else next.delete(key);
      setParams(next, { replace: !id });
    },
  ];
}
