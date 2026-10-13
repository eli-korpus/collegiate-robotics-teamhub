import { canWith, useMe, useModuleSettings, useRows } from '@teamhub/sdk';

export type JobStatus = 'submitted' | 'queued' | 'in_progress' | 'done' | 'failed' | 'cancelled';

export interface Job {
  id: string;
  team_id: string | null;
  title: string;
  method: string;
  qty: number;
  material: string | null;
  color: string | null;
  priority: number;
  needed_by: string | null;
  status: JobStatus;
  params: string | null;
  notes: string | null;
  onshape_url: string | null;
  keep_files: boolean;
  requested_by: string | null;
  assigned_to: string | null;
  created_at: string;
  done_at: string | null;
}

export interface Method {
  id: string;
  name: string;
  positions: string[];
}

export interface Settings {
  methods: Method[];
  autoDeleteDays: number;
  maxFileMB: number;
}

export const STATUS: Record<JobStatus, { label: string; tone: 'neutral' | 'info' | 'accent' | 'success' | 'danger' | 'warning' }> = {
  submitted: { label: 'Submitted', tone: 'neutral' },
  queued: { label: 'Queued', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'accent' },
  done: { label: 'Done', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'warning' },
};

export const useJobs = () => useRows<Job>(['manufacture', 'jobs'], (sb) => sb.from('mfg_jobs').select('*').order('priority', { ascending: false }).order('created_at'));

export const useMfgSettings = () => useModuleSettings<Settings>('manufacture');

export function canManage(me: ReturnType<typeof useMe>, j: Pick<Job, 'method' | 'team_id'>) {
  return canWith(me, `manufacture.manage_${j.method}`, j.team_id) || canWith(me, 'manufacture.delete_any', j.team_id);
}
