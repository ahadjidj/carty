import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initStore } from "./store";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

function renderLoading(msg: string, error = false) {
  root.render(
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-center">
        <div className="w-10 h-10 rounded-lg bg-brand-600 text-white grid place-items-center font-semibold mx-auto mb-3">
          C
        </div>
        <div
          className={
            "text-sm " + (error ? "text-red-600" : "text-slate-600")
          }
        >
          {msg}
        </div>
      </div>
    </div>,
  );
}

renderLoading("Loading SQLite engine…");

initStore()
  .then(() => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  })
  .catch((err) => {
    console.error(err);
    renderLoading(
      "Failed to initialize local database: " + (err?.message ?? err),
      true,
    );
  });
