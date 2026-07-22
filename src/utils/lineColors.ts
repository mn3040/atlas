export const LINE_COLORS = [
  '#e8734a', // day 1 — terracotta
  '#4fb8ae', // day 2 — turquoise
  '#e3b23c', // day 3 — amber
  '#d06a93', // day 4 — rose
  '#8fbf6b', // day 5 — sage
  '#6e9fe0', // day 6 — steel blue
] as const

export function lineColorForIndex(index: number): string {
  return LINE_COLORS[index % LINE_COLORS.length]
}
