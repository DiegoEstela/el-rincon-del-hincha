/** Next focus index inside a trap of `total` focusable elements, wrapping at both ends. */
export function nextFocusIndex(current: number, total: number, backwards: boolean): number {
  if (total <= 0) return -1;
  if (current < 0) return backwards ? total - 1 : 0;
  return (current + (backwards ? -1 : 1) + total) % total;
}
