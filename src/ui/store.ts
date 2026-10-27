// App state: engine data (catalog/rules/settings), the load being built, and the list being edited.
// Every change goes through `act`, which keeps the last 20 snapshots for undo.
import { useSyncExternalStore } from 'react';
import { getKV, loadEngineData, saveEngineData, setKV } from '../db/db';
import { loadSeed } from '../data/seed';
import { emptyOverrides, type EngineData, type Job, type Overrides, type VariantSpec } from '../engine';

export interface Work {
  /** Callout as typed. */
  callout: string;
  spec: VariantSpec;
  overrides: Overrides;
  /** Set when the edits came from "my version". */
  fromMyVersion: boolean;
  /** Set when editing a tower that's already in the load. */
  towerId: string | null;
}

interface Snapshot {
  data: EngineData;
  job: Job;
  work: Work | null;
}

export interface State extends Snapshot {
  ready: boolean;
  dataEdited: boolean;
  undo: { label: string; snap: Snapshot; dataEdited: boolean }[];
  toast: string | null;
}

const UNDO_LIMIT = 20;

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function newJob(): Job {
  const now = Date.now();
  return { id: uid(), createdAt: now, updatedAt: now, foreman: '', job: '', location: '', status: 'draft', notes: '', towers: [] };
}

let state: State = {
  ready: false,
  data: loadSeed(),
  dataEdited: false,
  job: newJob(),
  work: null,
  undo: [],
  toast: null,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getState(): State {
  return state;
}

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
}

/** Save immediately: actions are discrete commits, and a phone app can be closed at any moment. */
function persist(prev: State) {
  const s = state;
  if (s.data !== prev.data || s.dataEdited !== prev.dataEdited) void saveEngineData(s.data, s.dataEdited);
  if (s.job !== prev.job) void setKV('currentJob', s.job);
  if (s.work !== prev.work) void setKV('work', s.work);
}

export interface ActOptions {
  /** Marks catalog/rules/settings as user-edited (so seed updates no longer replace them). */
  editsData?: boolean;
  /** Skip the undo stack (e.g. typing in a field that has its own commit). */
  noUndo?: boolean;
}

/** Apply a change. Keeps an undo snapshot unless noUndo. */
export function act(label: string, fn: (s: State) => Partial<Snapshot>, opts: ActOptions = {}): void {
  const prev = state;
  const patch = fn(state);
  const undo = opts.noUndo
    ? state.undo
    : [...state.undo, { label, snap: { data: prev.data, job: prev.job, work: prev.work }, dataEdited: prev.dataEdited }].slice(-UNDO_LIMIT);
  const job = patch.job && patch.job !== prev.job ? { ...patch.job, updatedAt: Date.now() } : (patch.job ?? prev.job);
  set({ ...patch, job, undo, dataEdited: opts.editsData ? true : state.dataEdited });
  persist(prev);
}

export function undoLast(): void {
  const last = state.undo[state.undo.length - 1];
  if (!last) return;
  const prev = state;
  set({ ...last.snap, dataEdited: last.dataEdited, undo: state.undo.slice(0, -1), toast: `Undid: ${last.label}` });
  persist(prev);
}

export function toast(msg: string | null): void {
  set({ toast: msg });
}

export async function initStore(): Promise<void> {
  const { data, edited, invalid } = await loadEngineData();
  const job = (await getKV<Job>('currentJob')) ?? newJob();
  const work = (await getKV<Work | null>('work')) ?? null;
  set({ ready: true, data, dataEdited: edited, job, work, toast: invalid ? 'Saved data was invalid — loaded the seed data' : null });
}

export function resetDataToSeed(): void {
  act('Reset catalog, rules and settings', () => ({ data: loadSeed() }));
  set({ dataEdited: false });
  void saveEngineData(state.data, false);
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selector(state),
  );
}

export function startWork(callout: string, spec: VariantSpec, overrides?: Overrides, fromMyVersion = false, towerId: string | null = null): void {
  act('Open list', () => ({ work: { callout, spec, overrides: overrides ?? emptyOverrides(), fromMyVersion, towerId } }), { noUndo: true });
}
