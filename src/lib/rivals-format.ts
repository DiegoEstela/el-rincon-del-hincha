// Small Spanish formatters of the rivals screen.

/** "+6", "-2" and "0": the sign shows, zero has none. */
export function formatBalance(balance: number): string {
  if (balance > 0) return `+${balance}`;
  return String(balance);
}

/** "1 rival", "12 rivales". */
export function pluralRivals(count: number): string {
  return count === 1 ? "1 rival" : `${count} rivales`;
}

/** "312 partidos contra 33 rivales", "1 partido contra 1 rival". */
export function matchesLine(matches: number, rivals: number): string {
  const played = matches === 1 ? "1 partido" : `${matches} partidos`;
  return `${played} contra ${pluralRivals(rivals)}`;
}
