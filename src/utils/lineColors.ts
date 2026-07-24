// Six inks drawn from Atlas's own travel-document vocabulary (avatar colors,
// budget categories) rather than a fresh categorical palette. Every value
// must stay legible against both --color-surface and --color-ink, since day
// dots, timeline lines, and badges render on both.
export const LINE_COLORS = ['#22dd85', '#f7ff88', '#5bd7f3', '#ff715b', '#ffb454', '#bca5ed'] as const

export function lineColorForIndex(index: number): string {
  return LINE_COLORS[index % LINE_COLORS.length]
}

export function textColorForLine(color: string): string {
  const normalized = color.toLowerCase()
  return normalized === '#083740' || normalized === '#070606' ? '#fefefe' : '#070606'
}
