import initSqlJs, { Database, SqlJsStatic } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { idbGet, idbSet } from "./idbkv";
import {
  AppState,
  DEFAULT_SETTINGS,
  ExerciseEvent,
  Grant,
  SaleEvent,
  Settings,
  VestingEvent,
} from "./types";

const DB_KEY = "sqlite.v1";
const LS_LEGACY = "carty.state.v1";
const LS_MIGRATED_FLAG = "carty.migrated.sqlite.v1";

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let saveTimer: number | null = null;
let saveInFlight: Promise<void> | null = null;

export async function initDb(): Promise<void> {
  if (db) return;
  SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const raw = await idbGet<Uint8Array>(DB_KEY);
  db = raw ? new SQL.Database(raw) : new SQL.Database();
  applySchema();
  await maybeMigrateFromLocalStorage();
  await saveNow();
}

function applySchema() {
  if (!db) return;
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS grants (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      type TEXT NOT NULL,
      grant_date TEXT NOT NULL,
      total_quantity REAL NOT NULL,
      strike_usd REAL,
      fmv_at_grant_usd REAL,
      fx_at_grant REAL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS vesting_schedule (
      grant_id TEXT NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      quantity REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vs_grant ON vesting_schedule(grant_id);

    CREATE TABLE IF NOT EXISTS vestings (
      id TEXT PRIMARY KEY,
      grant_id TEXT NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      quantity REAL NOT NULL,
      fmv_usd REAL NOT NULL,
      fx_rate REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vestings_grant ON vestings(grant_id);

    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      grant_id TEXT NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      quantity REAL NOT NULL,
      fmv_usd REAL NOT NULL,
      fx_rate REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_exercises_grant ON exercises(grant_id);

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      grant_id TEXT NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      quantity REAL NOT NULL,
      sale_price_usd REAL NOT NULL,
      fx_rate REAL NOT NULL,
      fees REAL
    );
    CREATE INDEX IF NOT EXISTS idx_sales_grant ON sales(grant_id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value REAL NOT NULL
    );
  `);
}

function countRows(table: string): number {
  if (!db) return 0;
  const res = db.exec(`SELECT COUNT(*) FROM ${table}`);
  const v = res[0]?.values[0]?.[0];
  return typeof v === "number" ? v : Number(v ?? 0);
}

async function maybeMigrateFromLocalStorage() {
  if (!db) return;
  if (localStorage.getItem(LS_MIGRATED_FLAG)) return;
  const has = countRows("grants") + countRows("vestings");
  if (has > 0) {
    localStorage.setItem(LS_MIGRATED_FLAG, "1");
    return;
  }
  const raw = localStorage.getItem(LS_LEGACY);
  if (!raw) {
    localStorage.setItem(LS_MIGRATED_FLAG, "1");
    return;
  }
  try {
    const state = JSON.parse(raw) as AppState;
    db.exec("BEGIN");
    for (const g of state.grants ?? []) insertGrantRow(g);
    for (const v of state.vestings ?? []) insertVestingRow(v);
    for (const e of state.exercises ?? []) insertExerciseRow(e);
    for (const s of state.sales ?? []) insertSaleRow(s);
    if (state.settings) writeSettings({ ...DEFAULT_SETTINGS, ...state.settings });
    db.exec("COMMIT");
    localStorage.setItem(LS_MIGRATED_FLAG, "1");
  } catch {
    db.exec("ROLLBACK");
  }
}

function scheduleSave() {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void saveNow();
  }, 150);
}

export async function saveNow(): Promise<void> {
  if (!db) return;
  if (saveInFlight) await saveInFlight;
  const data = db.export();
  saveInFlight = idbSet(DB_KEY, data);
  try {
    await saveInFlight;
  } finally {
    saveInFlight = null;
  }
}

export function loadState(): AppState {
  if (!db)
    return {
      grants: [],
      vestings: [],
      exercises: [],
      sales: [],
      settings: DEFAULT_SETTINGS,
    };

  const grants = loadGrants();
  const vestings = selectAll<VestingEvent>(
    `SELECT id, grant_id AS grantId, date, quantity, fmv_usd AS fmvUSD, fx_rate AS fxRate
     FROM vestings ORDER BY date`,
  );
  const exercises = selectAll<ExerciseEvent>(
    `SELECT id, grant_id AS grantId, date, quantity, fmv_usd AS fmvUSD, fx_rate AS fxRate
     FROM exercises ORDER BY date`,
  );
  const sales = selectAll<SaleEvent>(
    `SELECT id, grant_id AS grantId, date, quantity,
            sale_price_usd AS salePriceUSD, fx_rate AS fxRate, fees
     FROM sales ORDER BY date`,
  ).map((s) => ({ ...s, fees: s.fees ?? undefined }));

  return { grants, vestings, exercises, sales, settings: readSettings() };
}

function selectAll<T>(sql: string): T[] {
  if (!db) return [];
  const stmt = db.prepare(sql);
  const out: T[] = [];
  while (stmt.step()) out.push(stmt.getAsObject() as unknown as T);
  stmt.free();
  return out;
}

function loadGrants(): Grant[] {
  if (!db) return [];
  const grants: Grant[] = [];
  const stmt = db.prepare(
    `SELECT id, symbol, type, grant_date, total_quantity,
            strike_usd, fmv_at_grant_usd, fx_at_grant, notes
     FROM grants ORDER BY grant_date`,
  );
  while (stmt.step()) {
    const r = stmt.getAsObject() as Record<string, unknown>;
    grants.push({
      id: String(r.id),
      symbol: String(r.symbol),
      type: r.type as Grant["type"],
      grantDate: String(r.grant_date),
      totalQuantity: Number(r.total_quantity),
      strikeUSD: r.strike_usd == null ? undefined : Number(r.strike_usd),
      fmvAtGrantUSD:
        r.fmv_at_grant_usd == null ? undefined : Number(r.fmv_at_grant_usd),
      fxAtGrant: r.fx_at_grant == null ? undefined : Number(r.fx_at_grant),
      notes: r.notes == null ? undefined : String(r.notes),
      vestingSchedule: [],
    });
  }
  stmt.free();

  const sched = db.prepare(
    `SELECT grant_id, date, quantity FROM vesting_schedule ORDER BY date`,
  );
  const byId = new Map(grants.map((g) => [g.id, g]));
  while (sched.step()) {
    const r = sched.getAsObject() as Record<string, unknown>;
    const g = byId.get(String(r.grant_id));
    if (g)
      g.vestingSchedule.push({
        date: String(r.date),
        quantity: Number(r.quantity),
      });
  }
  sched.free();
  return grants;
}

function readSettings(): Settings {
  if (!db) return DEFAULT_SETTINGS;
  const out: Settings = { ...DEFAULT_SETTINGS };
  const stmt = db.prepare(`SELECT key, value FROM settings`);
  while (stmt.step()) {
    const r = stmt.getAsObject() as { key: string; value: number };
    if (r.key in out) (out as unknown as Record<string, number>)[r.key] = r.value;
  }
  stmt.free();
  return out;
}

function writeSettings(s: Settings) {
  if (!db) return;
  db.run(`DELETE FROM settings`);
  const stmt = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`);
  for (const [k, v] of Object.entries(s)) {
    stmt.run([k, Number(v)]);
  }
  stmt.free();
}

function insertGrantRow(g: Grant) {
  if (!db) return;
  db.run(
    `INSERT INTO grants (id, symbol, type, grant_date, total_quantity,
       strike_usd, fmv_at_grant_usd, fx_at_grant, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      g.id,
      g.symbol,
      g.type,
      g.grantDate,
      g.totalQuantity,
      g.strikeUSD ?? null,
      g.fmvAtGrantUSD ?? null,
      g.fxAtGrant ?? null,
      g.notes ?? null,
    ],
  );
  for (const t of g.vestingSchedule) {
    db.run(
      `INSERT INTO vesting_schedule (grant_id, date, quantity) VALUES (?, ?, ?)`,
      [g.id, t.date, t.quantity],
    );
  }
}

function insertVestingRow(v: VestingEvent) {
  if (!db) return;
  db.run(
    `INSERT INTO vestings (id, grant_id, date, quantity, fmv_usd, fx_rate)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [v.id, v.grantId, v.date, v.quantity, v.fmvUSD, v.fxRate],
  );
}

function insertExerciseRow(e: ExerciseEvent) {
  if (!db) return;
  db.run(
    `INSERT INTO exercises (id, grant_id, date, quantity, fmv_usd, fx_rate)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [e.id, e.grantId, e.date, e.quantity, e.fmvUSD, e.fxRate],
  );
}

function insertSaleRow(s: SaleEvent) {
  if (!db) return;
  db.run(
    `INSERT INTO sales (id, grant_id, date, quantity, sale_price_usd, fx_rate, fees)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      s.id,
      s.grantId,
      s.date,
      s.quantity,
      s.salePriceUSD,
      s.fxRate,
      s.fees ?? null,
    ],
  );
}

export function addGrant(g: Grant) {
  if (!db) return;
  db.exec("BEGIN");
  try {
    insertGrantRow(g);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  scheduleSave();
}

export function updateGrant(id: string, g: Grant) {
  if (!db) return;
  db.exec("BEGIN");
  try {
    db.run(
      `UPDATE grants SET symbol=?, type=?, grant_date=?, total_quantity=?,
         strike_usd=?, fmv_at_grant_usd=?, fx_at_grant=?, notes=?
       WHERE id=?`,
      [
        g.symbol,
        g.type,
        g.grantDate,
        g.totalQuantity,
        g.strikeUSD ?? null,
        g.fmvAtGrantUSD ?? null,
        g.fxAtGrant ?? null,
        g.notes ?? null,
        id,
      ],
    );
    db.run(`DELETE FROM vesting_schedule WHERE grant_id=?`, [id]);
    for (const t of g.vestingSchedule) {
      db.run(
        `INSERT INTO vesting_schedule (grant_id, date, quantity) VALUES (?, ?, ?)`,
        [id, t.date, t.quantity],
      );
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  scheduleSave();
}

export function deleteGrant(id: string) {
  if (!db) return;
  db.run(`DELETE FROM grants WHERE id=?`, [id]);
  scheduleSave();
}

export function addVesting(v: VestingEvent) {
  insertVestingRow(v);
  scheduleSave();
}

export function deleteVesting(id: string) {
  db?.run(`DELETE FROM vestings WHERE id=?`, [id]);
  scheduleSave();
}

export function addExercise(e: ExerciseEvent) {
  insertExerciseRow(e);
  scheduleSave();
}

export function deleteExercise(id: string) {
  db?.run(`DELETE FROM exercises WHERE id=?`, [id]);
  scheduleSave();
}

export function addSale(s: SaleEvent) {
  insertSaleRow(s);
  scheduleSave();
}

export function deleteSale(id: string) {
  db?.run(`DELETE FROM sales WHERE id=?`, [id]);
  scheduleSave();
}

export function updateSettings(patch: Partial<Settings>) {
  if (!db) return;
  const merged = { ...readSettings(), ...patch };
  db.exec("BEGIN");
  try {
    writeSettings(merged);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  scheduleSave();
}

export function wipeAll() {
  if (!db) return;
  db.exec(`
    BEGIN;
    DELETE FROM vesting_schedule;
    DELETE FROM vestings;
    DELETE FROM exercises;
    DELETE FROM sales;
    DELETE FROM grants;
    DELETE FROM settings;
    COMMIT;
  `);
  scheduleSave();
}

export function importState(raw: string) {
  if (!db) return;
  const state = JSON.parse(raw) as AppState;
  db.exec("BEGIN");
  try {
    db.exec(`
      DELETE FROM vesting_schedule;
      DELETE FROM vestings;
      DELETE FROM exercises;
      DELETE FROM sales;
      DELETE FROM grants;
      DELETE FROM settings;
    `);
    for (const g of state.grants ?? []) insertGrantRow(g);
    for (const v of state.vestings ?? []) insertVestingRow(v);
    for (const e of state.exercises ?? []) insertExerciseRow(e);
    for (const s of state.sales ?? []) insertSaleRow(s);
    writeSettings({ ...DEFAULT_SETTINGS, ...(state.settings ?? {}) });
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  scheduleSave();
}

export function exportDbBinary(): Uint8Array {
  if (!db) throw new Error("DB not initialized");
  return db.export();
}

export async function replaceDbFromBinary(bytes: Uint8Array) {
  if (!SQL) throw new Error("SQL engine not loaded");
  db?.close();
  db = new SQL.Database(bytes);
  applySchema();
  await saveNow();
}
