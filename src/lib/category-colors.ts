// A small curated palette for folder (category) colors. Client-safe — just
// values. Tints are applied as a low-alpha wash so they read on light + dark.

export const CATEGORY_COLORS = [
  { key: 'pine', label: 'Pine', accent: '#2f8f66' },
  { key: 'clay', label: 'Clay', accent: '#c2643f' },
  { key: 'amber', label: 'Amber', accent: '#c2922f' },
  { key: 'sage', label: 'Sage', accent: '#6f9466' },
  { key: 'blue', label: 'Blue', accent: '#4f7fb5' },
  { key: 'plum', label: 'Plum', accent: '#8a5a86' },
  { key: 'rose', label: 'Rose', accent: '#c0697f' },
] as const

export type CategoryColorKey = (typeof CATEGORY_COLORS)[number]['key']

export const CATEGORY_COLOR_KEYS: ReadonlyArray<string> = CATEGORY_COLORS.map(
  (c) => c.key,
)

/** Accent hex for a color key, or null for none/unknown. */
export function colorAccent(key: string | null | undefined): string | null {
  return CATEGORY_COLORS.find((c) => c.key === key)?.accent ?? null
}

/** A low-alpha tint of the accent for backgrounds (e.g. "#2f8f6624"). */
export function colorTint(key: string | null | undefined): string | null {
  const accent = colorAccent(key)
  return accent ? `${accent}24` : null
}
