const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});
const countFormatter = new Intl.NumberFormat();
const RELATIVE_CUTOFF_SECONDS = 7 * 24 * 60 * 60;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function parseIso(iso: string): Date | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function formatRelativeTime(iso: string): string {
  const date = parseIso(iso);
  if (!date) {
    return iso;
  }

  const now = Date.now();
  const delta = (date.getTime() - now) / 1000;
  const abs = Math.abs(delta);

  if (abs >= RELATIVE_CUTOFF_SECONDS) {
    return formatDateTime(iso);
  }

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, size] of units) {
    if (abs >= size || unit === "second") {
      const value = unit === "second"
        ? Math.round(delta / size)
        : Math.trunc(delta / size);
      return relativeTimeFormatter.format(value, unit);
    }
  }

  return iso;
}

export function formatDateTime(iso: string): string {
  const date = parseIso(iso);
  if (!date) {
    return iso;
  }

  // Keep formatting deterministic between server render and client hydration.
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())} UTC`;
}

export function formatCount(value: number): string {
  return countFormatter.format(value);
}
