import { addMonths, format, parseISO } from "date-fns";

/** Календарная дата YYYY-MM-DD минус N дней (без привязки к TZ суток). */
export function ymdSubDays(ymd: string, days: number): string {
  const d = parseISO(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return format(d, "yyyy-MM-dd");
}

export function ymdAddMonths(ymd: string, months: number): string {
  const d = parseISO(`${ymd}T12:00:00.000Z`);
  return format(addMonths(d, months), "yyyy-MM-dd");
}
