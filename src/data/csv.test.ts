import { describe, expect, it } from 'vitest';
import { backupSchema, jobSchema } from './backup';
import { catalogToCsv, csvToCatalog, parseCsv } from './csv';
import { loadSeed } from './seed';

describe('catalog CSV', () => {
  const d = loadSeed();

  it('round-trips the whole catalog', () => {
    const { parts, errors } = csvToCatalog(catalogToCsv(d.catalog));
    expect(errors).toEqual([]);
    expect(parts).toEqual(d.catalog);
  });

  it('parses quotes, commas and newlines', () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n1,2,"x\ny"\n')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['1', '2', 'x\ny'],
    ]);
  });

  it('reports bad rows and missing columns', () => {
    expect(csvToCatalog('name\nx').errors[0]).toMatch(/Missing column/);
    const r = csvToCatalog('id,name,category,size\nok,Thing,other,1.5\nbad,Bad,other,-1');
    expect(r.parts.map((p) => p.id)).toEqual(['ok']);
    expect(r.errors[0]).toMatch(/Row 3 \(bad\)/);
  });
});

describe('backup schema', () => {
  it('accepts a full export', () => {
    const b = { app: 'scaffold-loadout', version: 1, exportedAt: 1, data: loadSeed(), jobs: [], myVersions: [], ruleVersions: [], recents: [] };
    expect(backupSchema.safeParse(b).success).toBe(true);
    expect(backupSchema.safeParse({ ...b, app: 'other' }).success).toBe(false);
    expect(jobSchema.safeParse({}).success).toBe(false);
  });
});
