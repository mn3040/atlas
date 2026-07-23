export const LINE_COLORS = ['#22dd85', '#f7ff88', '#083740', '#fefefe', '#070606'] as const

export function lineColorForIndex(index: number): string {
  return LINE_COLORS[index % LINE_COLORS.length]
}

export function textColorForLine(color: string): string {
  const normalized = color.toLowerCase()
  return normalized === '#083740' || normalized === '#070606' ? '#fefefe' : '#070606'
}
