import { useCallback, useEffect, useSyncExternalStore } from "react";
import * as db from "./db";
import {
  AppState,
  EMPTY_STATE,
  ExerciseEvent,
  Grant,
  SaleEvent,
  Settings,
  VestingEvent,
} from "./types";

let current: AppState = EMPTY_STATE;
let ready = false;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function refresh() {
  current = db.loadState();
  notify();
}

export async function initStore(): Promise<void> {
  if (ready) return;
  await db.initDb();
  ready = true;
  refresh();
}

export function isStoreReady(): boolean {
  return ready;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return current;
}

export function useStore() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!ready) void initStore();
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    db.updateSettings(patch);
    refresh();
  }, []);

  const addGrant = useCallback((g: Grant) => {
    db.addGrant(g);
    refresh();
  }, []);

  const updateGrant = useCallback((id: string, patch: Partial<Grant>) => {
    const existing = current.grants.find((g) => g.id === id);
    if (!existing) return;
    const next: Grant = { ...existing, ...patch, id };
    db.updateGrant(id, next);
    refresh();
  }, []);

  const deleteGrant = useCallback((id: string) => {
    db.deleteGrant(id);
    refresh();
  }, []);

  const addVesting = useCallback((v: VestingEvent) => {
    db.addVesting(v);
    refresh();
  }, []);

  const deleteVesting = useCallback((id: string) => {
    db.deleteVesting(id);
    refresh();
  }, []);

  const addExercise = useCallback((e: ExerciseEvent) => {
    db.addExercise(e);
    refresh();
  }, []);

  const deleteExercise = useCallback((id: string) => {
    db.deleteExercise(id);
    refresh();
  }, []);

  const addSale = useCallback((x: SaleEvent) => {
    db.addSale(x);
    refresh();
  }, []);

  const deleteSale = useCallback((id: string) => {
    db.deleteSale(id);
    refresh();
  }, []);

  const resetAll = useCallback(() => {
    db.wipeAll();
    refresh();
  }, []);

  const importState = useCallback((raw: string) => {
    db.importState(raw);
    refresh();
  }, []);

  const exportDatabase = useCallback((): Uint8Array => db.exportDbBinary(), []);

  const replaceDatabase = useCallback(async (bytes: Uint8Array) => {
    await db.replaceDbFromBinary(bytes);
    refresh();
  }, []);

  return {
    state,
    updateSettings,
    addGrant,
    updateGrant,
    deleteGrant,
    addVesting,
    deleteVesting,
    addExercise,
    deleteExercise,
    addSale,
    deleteSale,
    resetAll,
    importState,
    exportDatabase,
    replaceDatabase,
  };
}
