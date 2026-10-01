import type { ModuleClient } from './types';

export function defineClient(marker: `teamhub-module:${string}`, client: ModuleClient): ModuleClient & { marker: string } {
  return { ...client, marker };
}
