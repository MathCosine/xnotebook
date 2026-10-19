const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });

export const dayKey = (iso: string) => new Date(iso).toDateString();

export function clock(iso: string) {
  return timeFmt.format(new Date(iso)).replace(/\s?(AM|PM)$/i, (m) => m.trim().toLowerCase());
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 864e5);
  if (d.toDateString() === today.toDateString()) return "today";
  if (d.toDateString() === yesterday.toDateString()) return "yesterday";
  if (Date.now() - d.getTime() < 6 * 864e5) return weekdayFmt.format(d);
  return dayFmt.format(d);
}

export function ago(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return dayLabel(iso);
}
