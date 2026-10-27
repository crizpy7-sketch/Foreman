// IndexedDB via Dexie. Everything lives on the device; no server.
import Dexie, { type Table } from 'dexie';
import { backupSchema, type Backup, type MyVersion, type Recent, type RuleVersion } from '../data/backup';
import { engineDataSchema } from '../data/schema';
import { loadSeed } from '../data/seed';
import type { EngineData, Job } from '../engine';

interface KV {
  key: string;
  value: unknown;
}

class LoadoutDB extends Dexie {
  kv!: Table<KV, string>;
  jobs!: Table<Job, string>;
  myVersions!: Table<MyVersion, string>;
  ruleVersions!: Table<RuleVersion, number>;
  recents!: Table<Recent, string>;

  constructor() {
    super('scaffold-loadout');
    this.version(1).stores({
      kv: 'key',
      jobs: 'id, updatedAt',
      myVersions: 'key',
      ruleVersions: '++id, savedAt',
      recents: 'callout, at',
    });
  }
}

export const db = new LoadoutDB();

export async function getKV<T>(key: string): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined;
}

export async function setKV(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}

/** Stored engine data if valid, else the seed. `edited` = the user has changed catalog/rules/settings. */
export async function loadEngineData(): Promise<{ data: EngineData; edited: boolean; invalid: boolean }> {
  const stored = await getKV<unknown>('engineData');
  const edited = (await getKV<boolean>('dataEdited')) ?? false;
  if (stored && edited) {
    const r = engineDataSchema.safeParse(stored);
    if (r.success) return { data: r.data, edited, invalid: false };
    return { data: loadSeed(), edited: false, invalid: true };
  }
  return { data: loadSeed(), edited: false, invalid: false };
}

export async function saveEngineData(data: EngineData, edited: boolean): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    await setKV('engineData', data);
    await setKV('dataEdited', edited);
  });
}

export async function addRecent(callout: string): Promise<void> {
  const prev = await db.recents.get(callout);
  await db.recents.put({ callout, at: Date.now(), favorite: prev?.favorite ?? false });
  const all = await db.recents.orderBy('at').reverse().toArray();
  const stale = all.filter((r) => !r.favorite).slice(20);
  await db.recents.bulkDelete(stale.map((r) => r.callout));
}

export async function exportAll(data: EngineData): Promise<Backup> {
  return {
    app: 'scaffold-loadout',
    version: 1,
    exportedAt: Date.now(),
    data,
    jobs: await db.jobs.toArray(),
    myVersions: await db.myVersions.toArray(),
    ruleVersions: await db.ruleVersions.toArray(),
    recents: await db.recents.toArray(),
  };
}

export async function importAll(json: unknown): Promise<{ ok: true; data: EngineData } | { ok: false; error: string }> {
  const r = backupSchema.safeParse(json);
  if (!r.success) return { ok: false, error: r.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  const b = r.data;
  await db.transaction('rw', [db.kv, db.jobs, db.myVersions, db.ruleVersions, db.recents], async () => {
    await Promise.all([db.jobs.clear(), db.myVersions.clear(), db.ruleVersions.clear(), db.recents.clear()]);
    await db.jobs.bulkPut(b.jobs as Job[]);
    await db.myVersions.bulkPut(b.myVersions);
    await db.ruleVersions.bulkPut(b.ruleVersions);
    await db.recents.bulkPut(b.recents);
    await setKV('engineData', b.data);
    await setKV('dataEdited', true);
  });
  return { ok: true, data: b.data };
}
