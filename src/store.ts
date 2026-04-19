import { useCallback, useEffect, useState } from "react";
import {
  AppState,
  EMPTY_STATE,
  ExerciseEvent,
  Grant,
  SaleEvent,
  Settings,
  VestingEvent,
} from "./types";

const KEY = "carty.state.v1";

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as AppState;
    return {
      ...EMPTY_STATE,
      ...parsed,
      settings: { ...EMPTY_STATE.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return EMPTY_STATE;
  }
}

function save(state: AppState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function useStore() {
  const [state, setState] = useState<AppState>(() => load());

  useEffect(() => {
    save(state);
  }, [state]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const addGrant = useCallback((g: Grant) => {
    setState((s) => ({ ...s, grants: [...s.grants, g] }));
  }, []);

  const updateGrant = useCallback((id: string, patch: Partial<Grant>) => {
    setState((s) => ({
      ...s,
      grants: s.grants.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  }, []);

  const deleteGrant = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      grants: s.grants.filter((g) => g.id !== id),
      vestings: s.vestings.filter((v) => v.grantId !== id),
      exercises: s.exercises.filter((e) => e.grantId !== id),
      sales: s.sales.filter((x) => x.grantId !== id),
    }));
  }, []);

  const addVesting = useCallback((v: VestingEvent) => {
    setState((s) => ({ ...s, vestings: [...s.vestings, v] }));
  }, []);

  const deleteVesting = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      vestings: s.vestings.filter((v) => v.id !== id),
    }));
  }, []);

  const addExercise = useCallback((e: ExerciseEvent) => {
    setState((s) => ({ ...s, exercises: [...s.exercises, e] }));
  }, []);

  const deleteExercise = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      exercises: s.exercises.filter((e) => e.id !== id),
    }));
  }, []);

  const addSale = useCallback((x: SaleEvent) => {
    setState((s) => ({ ...s, sales: [...s.sales, x] }));
  }, []);

  const deleteSale = useCallback((id: string) => {
    setState((s) => ({ ...s, sales: s.sales.filter((x) => x.id !== id) }));
  }, []);

  const resetAll = useCallback(() => setState(EMPTY_STATE), []);

  const importState = useCallback((raw: string) => {
    const parsed = JSON.parse(raw) as AppState;
    setState({
      ...EMPTY_STATE,
      ...parsed,
      settings: { ...EMPTY_STATE.settings, ...(parsed.settings || {}) },
    });
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
  };
}
