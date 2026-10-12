// The three date-of-birth boxes as YYYY-MM-DD, or null if that day doesn't exist (31/02, 2-digit year).
export function toBirthDate(
  day: string,
  month: string,
  year: string,
): string | null {
  const [d, m, y] = [day, month, year].map(part => Number(part.trim()));
  if (
    !/^\d{4}$/.test(year.trim()) ||
    !Number.isInteger(d) ||
    !Number.isInteger(m)
  ) {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}
