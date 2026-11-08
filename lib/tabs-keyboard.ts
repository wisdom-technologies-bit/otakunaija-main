/** Roving-tabindex keyboard handling for a horizontal tablist. */
export function nextTabIndex(index: number, count: number, key: string): number | null {
  if (!Number.isFinite(count) || count <= 0) return null
  const safe = ((Math.trunc(index) % count) + count) % count
  switch (key) {
    case "ArrowRight":
      return (safe + 1) % count
    case "ArrowLeft":
      return (safe - 1 + count) % count
    case "Home":
      return 0
    case "End":
      return count - 1
    default:
      return null
  }
}
