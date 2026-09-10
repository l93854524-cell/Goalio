const DAY_MS = 86_400_000;

function utcDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toISO(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayISO(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  return toISO(new Date(utcDate(iso).getTime() + days * DAY_MS));
}

export function daysBetween(start: string, end: string): number {
  return Math.round((utcDate(end).getTime() - utcDate(start).getTime()) / DAY_MS);
}

export function addMonths(iso: string, months: number): string {
  const source = utcDate(iso);
  const targetMonth = source.getUTCMonth() + months;
  const year = source.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return toISO(new Date(Date.UTC(year, month, Math.min(source.getUTCDate(), lastDay))));
}

export function formatChineseDate(iso: string): string {
  const date = utcDate(iso);
  return `${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日`;
}

export function formatChineseFullDate(iso: string): string {
  const date = utcDate(iso);
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return `${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日 · ${weekdays[date.getUTCDay()]}`;
}
