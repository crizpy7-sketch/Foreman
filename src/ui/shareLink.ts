// Share links: the load compressed into the URL hash. No server involved.
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { z } from 'zod';
import { towerSchema } from '../data/backup';
import type { Job } from '../engine';

const payloadSchema = z.object({
  v: z.literal(1),
  job: z.string(),
  foreman: z.string(),
  location: z.string(),
  towers: z.array(towerSchema),
});

export function shareUrl(job: Job): string {
  const payload = { v: 1 as const, job: job.job, foreman: job.foreman, location: job.location, towers: job.towers };
  const base = window.location.href.split('#')[0];
  return `${base}#/share/${compressToEncodedURIComponent(JSON.stringify(payload))}`;
}

export function readShare(encoded: string): z.infer<typeof payloadSchema> | null {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const r = payloadSchema.safeParse(JSON.parse(json));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
