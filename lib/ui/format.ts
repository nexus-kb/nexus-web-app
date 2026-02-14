const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
const countFormatter = new Intl.NumberFormat();

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  const now = Date.now();
  const delta = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(delta);

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, size] of units) {
    if (abs >= size || unit === "second") {
      return relativeTimeFormatter.format(Math.round(delta / size), unit);
    }
  }

  return iso;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  // Keep formatting deterministic between server render and client hydration.
  return dateTimeFormatter.format(date);
}

export function formatCount(value: number): string {
  return countFormatter.format(value);
}
