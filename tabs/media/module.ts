import { z } from 'zod';
import { defineModule, definePermissions, type PermissionDefs } from '@teamhub/sdk/define';

export const permissions = definePermissions('media', {
  upload: { label: 'Add photos and albums', default: ['captain', 'mentor'], simple: true },
  delete_any: { label: 'Delete any photo or album', default: ['captain', 'mentor'] },
});

export const settings = z.object({
  membersCanUpload: z.boolean().default(false).meta({ title: 'Members can add photos too' }),
  maxPhotosPerAlbum: z.number().int().min(5).max(200).default(50).meta({ title: 'Max photos per album', description: 'Photos are compressed to ≤ 400 KB each.' }),
});

export default defineModule({
  id: 'media',
  prefix: 'med_',
  name: 'Media Gallery',
  category: 'outreach',
  icon: 'Images',
  summary: 'Share team photos (compressed automatically) and links to videos and photo albums.',
  purpose: 'Share team photos and video links.',
  notFor: [
    { text: 'File storage or backups', goTo: 'link:drive' },
    { text: 'Documents', goTo: 'link:drive' },
  ],
  footprint: 'Photos ≤ 400 KB each, up to 50 per album (setting)',
  usesFiles: true,
  stores: 'Albums, compressed photos and links to videos/albums elsewhere.',
  settings,
  permissions,
  dynamicPermissions: (s): PermissionDefs =>
    s.membersCanUpload
      ? { 'media.upload': { label: 'Add photos and albums', default: ['member', 'captain', 'mentor'], simple: true, key: 'media.upload', module: 'media' } }
      : {},
  suggestedPositions: ['Media Lead'],
  entities: ['album', 'item'],
  buckets: [{ id: 'media', public: false, maxFileMB: 0.4, mime: ['image/webp', 'image/jpeg', 'image/png'], uploadPerm: 'media.upload', deleteAnyPerm: 'media.delete_any' }],
  toolLinkSlots: ['drive'],
  widgets: [{ id: 'latest', title: 'Latest photos', defaultFor: ['member', 'captain', 'mentor'] }],
  exportTables: ['med_albums', 'med_items'],
});
