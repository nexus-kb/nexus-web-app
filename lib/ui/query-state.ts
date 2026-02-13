export function mergeSearchParams(
  current: URLSearchParams,
  updates: Record<string, string | null | undefined>,
): string {
  const next = new URLSearchParams(current.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "") {
      next.delete(key);
      continue;
    }
    next.set(key, value);
  }

  const nextString = next.toString();
  return nextString ? `?${nextString}` : "";
}
