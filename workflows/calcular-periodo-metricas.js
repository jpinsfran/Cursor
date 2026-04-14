/**
 * Cole no nó "Calcular Período" (n8n Code) — dia civil America/Sao_Paulo em UTC.
 * Saída: today_start / today_end (lte) / today_end_exclusive (RPC [from,to))
 */
const tz = "America/Sao_Paulo";
const now = new Date();
const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: tz,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).formatToParts(now);
const y = Number(parts.find((p) => p.type === "year").value);
const mo = Number(parts.find((p) => p.type === "month").value);
const day = Number(parts.find((p) => p.type === "day").value);
const today = `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const startMs = Date.UTC(y, mo - 1, day, 3, 0, 0, 0);
const endExclusiveMs = Date.UTC(y, mo - 1, day + 1, 3, 0, 0, 0);
const today_start = new Date(startMs).toISOString();
const today_end_exclusive = new Date(endExclusiveMs).toISOString();
const today_end = new Date(endExclusiveMs - 1).toISOString();

const refSpMs = Date.UTC(y, mo - 1, day, 15, 0, 0);
const dow = new Date(refSpMs).getUTCDay();
const mondayOffset = dow === 0 ? -6 : 1 - dow;
const monMs = refSpMs + mondayOffset * 86400000;
const sunMs = monMs + 6 * 86400000;
const week_start = new Date(monMs).toISOString().slice(0, 10);
const week_end = new Date(sunMs).toISOString().slice(0, 10);

return [
  {
    json: {
      today,
      week_start,
      week_end,
      today_start,
      today_end,
      today_end_exclusive,
    },
  },
];
