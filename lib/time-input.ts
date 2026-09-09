// Seconds are optional, but nonzero seconds remain significant.
export function normalizeTime(value: string): string | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(
    value.normalize("NFKC").trim(),
  );
  return match ? `${match[1]}:${match[2]}:${match[3] ?? "00"}` : null;
}
