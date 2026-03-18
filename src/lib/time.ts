export function getDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDaysBetween(a: string | undefined, b: string): number {
  if (!a) {
    return Number.POSITIVE_INFINITY;
  }

  const first = new Date(a);
  const second = new Date(b);
  const ms = second.getTime() - first.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function stableHash(input: string): number {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function parseTimeToDate(time: string, baseDate = new Date()): Date {
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  const target = new Date(baseDate);
  target.setHours(hours, minutes, 0, 0);
  return target;
}

function nextReminderAtLocal(time: string, quietWeekends: boolean, now: Date): Date {
  const next = parseTimeToDate(time, now);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  while (quietWeekends && [0, 6].includes(next.getDay())) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

function nextReminderAtFixedOffset(
  time: string,
  quietWeekends: boolean,
  fixedOffsetMinutes: number,
  now: Date
): Date {
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  const zonedNow = new Date(now.getTime() + fixedOffsetMinutes * 60_000);
  let year = zonedNow.getUTCFullYear();
  let month = zonedNow.getUTCMonth();
  let day = zonedNow.getUTCDate();
  let nextUtcMs = Date.UTC(year, month, day, hours, minutes) - fixedOffsetMinutes * 60_000;

  if (nextUtcMs <= now.getTime()) {
    const tomorrow = new Date(Date.UTC(year, month, day + 1, hours, minutes));
    year = tomorrow.getUTCFullYear();
    month = tomorrow.getUTCMonth();
    day = tomorrow.getUTCDate();
    nextUtcMs = Date.UTC(year, month, day, hours, minutes) - fixedOffsetMinutes * 60_000;
  }

  while (quietWeekends) {
    const zonedTarget = new Date(nextUtcMs + fixedOffsetMinutes * 60_000);

    if (![0, 6].includes(zonedTarget.getUTCDay())) {
      break;
    }

    nextUtcMs += 24 * 60 * 60 * 1000;
  }

  return new Date(nextUtcMs);
}

export function nextReminderAt(
  time: string,
  quietWeekends: boolean,
  now = new Date(),
  timezoneMode: "browser-local" | "fixed-offset" = "browser-local",
  fixedOffsetMinutes = 0
): Date {
  if (timezoneMode === "fixed-offset") {
    return nextReminderAtFixedOffset(time, quietWeekends, fixedOffsetMinutes, now);
  }

  return nextReminderAtLocal(time, quietWeekends, now);
}
