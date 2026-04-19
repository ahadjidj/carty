import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { GrantsTab } from "./components/GrantsTab";
import { EventsTab } from "./components/EventsTab";
import { Simulator } from "./components/Simulator";
import { TaxTab } from "./components/TaxTab";
import { SettingsTab } from "./components/SettingsTab";

type Tab = "dashboard" | "grants" | "events" | "simulator" | "tax" | "settings";

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "grants", label: "Grants" },
  { key: "events", label: "Events" },
  { key: "simulator", label: "Simulator" },
  { key: "tax", label: "Taxes" },
  { key: "settings", label: "Settings" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center font-semibold">
              C
            </div>
            <div>
              <div className="font-semibold">Carty</div>
              <div className="text-xs text-slate-500">
                Stock options & RSU manager — French tax
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={"tab " + (tab === t.key ? "tab-active" : "")}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === "dashboard" && <Dashboard />}
        {tab === "grants" && <GrantsTab />}
        {tab === "events" && <EventsTab />}
        {tab === "simulator" && <Simulator />}
        {tab === "tax" && <TaxTab />}
        {tab === "settings" && <SettingsTab />}
      </main>

      <footer className="max-w-6xl mx-auto px-4 py-6 text-xs text-slate-400">
        Estimates only. Consult a tax advisor — French stock / RSU tax is
        complex and depends on plan qualification, residency, holding period,
        and thresholds. Data is kept locally in your browser.
      </footer>
    </div>
  );
}
