export const LINE_COLORS = [
  '#f7ff88', // day 1 — yellow (chrome accent)
  '#22dd85', // day 2 — green
  '#bca5ed', // day 3 — purple
  '#5fd4e8', // day 4 — cyan
  '#ff8fa3', // day 5 — coral
  '#ffffff', // day 6 — white
] as const

export function lineColorForIndex(index: number): string {
  return LINE_COLORS[index % LINE_COLORS.length]
}
