export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const fmtEUR = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(isFinite(n) ? n : 0);

export const fmtEUR2 = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(isFinite(n) ? n : 0);

export const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(isFinite(n) ? n : 0);

export const fmtPct = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(isFinite(n) ? n : 0);

export const fmtQty = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 }).format(
    isFinite(n) ? n : 0,
  );

export const fmtDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR");
};

export const todayISO = () => new Date().toISOString().slice(0, 10);
