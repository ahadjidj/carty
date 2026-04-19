import { PropsWithChildren } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: PropsWithChildren<Props>) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl border border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="px-4 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
