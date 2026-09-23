export type BusinessHours = Record<string, [string, string]>;

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function isWithinBusinessHours(date: Date, hours: BusinessHours, timeZone = "Asia/Bangkok") {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dayMap: Record<string, string> = { Sun: "0", Mon: "1", Tue: "2", Wed: "3", Thu: "4", Fri: "5", Sat: "6" };
  const day = dayMap[value.weekday];
  const current = Number(value.hour) * 60 + Number(value.minute);
  const today = hours[day];
  if (today) {
    const start = minutes(today[0]);
    const end = minutes(today[1]);
    if (end > start && current >= start && current < end) return true;
    if (end <= start && current >= start) return true;
  }
  const previousDay = String((Number(day) + 6) % 7);
  const previous = hours[previousDay];
  if (previous && minutes(previous[1]) <= minutes(previous[0]) && current < minutes(previous[1])) return true;
  return false;
}
