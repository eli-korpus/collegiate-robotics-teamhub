import { z } from 'zod';
import { defineModule, definePermissions, type PermissionDefs } from '@teamhub/sdk/define';

export const permissions = definePermissions('manufacture', {
  submit: { label: 'Submit parts to be made', default: ['member', 'captain', 'mentor'], simple: true },
  delete_any: { label: 'Delete any job or file', default: ['mentor'] },
});

const Method = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/).meta({ title: 'id' }),
  name: z.string().meta({ title: 'Name' }),
  positions: z.array(z.string()).default([]).meta({ title: 'Position ids (e.g. pos_3d_print_farm_manager)' }),
});

export const settings = z.object({
  methods: z
    .array(Method)
    .default([
      { id: 'fdm', name: 'FDM 3D printing', positions: ['pos_3d_print_farm_manager'] },
      { id: 'resin', name: 'Resin printing', positions: ['pos_3d_print_farm_manager'] },
      { id: 'cnc', name: 'CNC', positions: ['pos_cnc_operator'] },
      { id: 'laser', name: 'Laser cutting', positions: [] },
      { id: 'outsourced', name: 'Outsourced', positions: [] },
      { id: 'machine_shop', name: 'Machine shop', positions: [] },
    ])
    .meta({ title: 'Manufacturing methods', description: 'Each method is handled by whoever holds its positions (mentors if nobody does).' }),
  autoDeleteDays: z.number().int().min(1).max(365).default(14).meta({ title: 'Delete model files this many days after a job is done', description: 'Unless the job is marked “keep files”.' }),
  maxFileMB: z.number().min(1).max(25).default(25).meta({ title: 'Max file size (MB, after compression)' }),
});

export default defineModule({
  id: 'manufacture',
  prefix: 'mfg_',
  name: 'To Manufacture',
  category: 'engineering',
  icon: 'Printer',
  summary: 'Queue parts for 3D printing, CNC, laser cutting and more — routed to whoever runs each machine.',
  purpose: 'Get a part made by the person responsible for that machine.',
  notFor: [
    { text: 'Buying parts', goTo: 'purchases' },
    { text: 'General to-dos', goTo: 'tasks' },
    { text: 'Storing CAD files', goTo: 'link:cad' },
  ],
  footprint: 'Model files up to 25 MB (compressed), auto-deleted after jobs finish',
  usesFiles: true,
  stores: 'Jobs (method, quantity, material, status) and their model files until they are made.',
  settings,
  permissions,
  dynamicPermissions: (s): PermissionDefs =>
    Object.fromEntries(
      s.methods.map((m) => [
        `manufacture.manage_${m.id}`,
        { label: `Run the ${m.name} queue`, default: ['mentor'], positions: m.positions, key: `manufacture.manage_${m.id}`, module: 'manufacture', simple: true },
      ]),
    ),
  suggestedPositions: ['3D Print Farm Manager', 'CNC Operator'],
  entities: ['job'],
  buckets: [
    {
      id: 'manufacture',
      public: false,
      maxFileMB: 25,
      mime: ['application/gzip', 'application/octet-stream', 'model/stl', 'model/obj', 'model/3mf', 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml', 'application/pdf', 'image/svg+xml', 'application/dxf', 'image/vnd.dxf', 'model/step', 'application/step'],
      uploadPerm: 'manufacture.submit',
      deleteAnyPerm: 'manufacture.delete_any',
    },
  ],
  toolLinkSlots: ['cad', 'printer_dashboard'],
  widgets: [
    { id: 'queue', title: 'Manufacturing queue', defaultFor: ['captain', 'mentor'] },
    { id: 'my-parts', title: 'Your parts', defaultFor: ['member'] },
  ],
  commentEntities: ['job'],
  refVisibility: { job: 'exists (select 1 from mfg_jobs j where j.id::text = {id} and teamhub_in_team(j.team_id))' },
  exportTables: ['mfg_jobs', 'mfg_files'],
  seasonRollover: { describe: 'Deletes files of finished jobs from the old season.', sql: `insert into teamhub_storage_trash (bucket, path) select 'manufacture', f.path from mfg_files f join mfg_jobs j on j.id = f.job_id where j.season = :old and j.status in ('done','failed','cancelled'); delete from mfg_files f using mfg_jobs j where j.id = f.job_id and j.season = :old and j.status in ('done','failed','cancelled');` },
});
