// MiloJulo design tokens, "Orchid pop". Source of truth: docs/05-ui-standards.md and docs/06-brand-colour.md.
// All sizes are logical points (iOS) / dp (Android); font sizes are sp.

export const colors = {
  orchid: '#CC2E86',
  orchidDark: '#8E1F60',
  tint: '#FFE3F1',
  tintStrong: '#FFC6E0',
  ground: '#FFF7FB',
  card: '#FFFFFF',
  ink: '#2B1233',
  secondary: '#6D5876',
  line: '#F3DDEA',
  butter: '#FFE27A',
  butterSoft: '#FFF1B8',
  lilac: '#C8B6FF',
  lilacSoft: '#E3D4FF', // Second prompt card on a profile
  violet: '#7B4DFF',
  danger: '#C62828',
  warnTint: '#FFE3DC',
  white: '#FFFFFF',
  field: '#E9CFE0', // Input, chip and secondary-button borders
  tagNeutral: '#FBEAF3', // Plain tag and segmented-control track
  tagNeutralInk: '#4A2F55', // Text on a plain tag
  selected: '#FFF1F8', // Selected option card, match note
  handle: '#EBD3E2', // Bottom-sheet handle
  track: '#F6DFEC', // Unfilled progress segment
  warnInk: '#8B1D1D', // Text on warnTint
  scrim: 'rgba(43,18,51,0.5)', // Behind bottom sheets
  photoInitial: 'rgba(43,18,51,0.42)', // Initial on a photo placeholder
} as const;

// Tags and chips only, never buttons.
export const modeTints = {
  friends: { bg: '#CFF1E5', fg: '#0B4A3E' },
  activities: { bg: '#FFF1B8', fg: '#2B1233' },
  networking: { bg: '#D6ECFF', fg: '#1F4E79' },
  dating: { bg: '#FFE3F1', fg: '#8E1F60' },
  serious: { bg: '#FFE3F1', fg: '#8E1F60' },
  casual: { bg: '#E3D4FF', fg: '#4B2BB8' },
} as const;

export const photoTones = ['#FFD1E8', '#E3D4FF', '#FFE9A8', '#CFF1E5'] as const;

// Activity card backgrounds by type (Activities mockup): the photo tones plus the Networking tint.
export const activityTones = {
  sports: '#FFE9A8',
  food_chai: '#CFF1E5',
  outdoors: '#E3D4FF',
  games: '#FFD1E8',
  learning: '#D6ECFF',
} as const;

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, x3: 40, x4: 48, x5: 64 } as const;
export const layout = { pageMargin: 20, blockGap: 16, sectionGap: 24, gridGutter: 12, cardPadding: 16, statusBar: 48, bottomInset: 34 } as const;

export const radius = { r16: 16, r20: 20, r24: 24, r28: 28, r32: 32, full: 999 } as const;

export const fonts = { display: 'Bricolage Grotesque', text: 'Figtree' } as const;

export const type = {
  display: { size: 40, line: 44, family: fonts.display, weight: '700' },
  h1: { size: 28, line: 32, family: fonts.display, weight: '700' },
  h2: { size: 20, line: 24, family: fonts.display, weight: '700' },
  title: { size: 17, line: 24, family: fonts.text, weight: '600' },
  body: { size: 16, line: 24, family: fonts.text, weight: '400' },
  bodySmall: { size: 14, line: 20, family: fonts.text, weight: '400' },
  label: { size: 16, line: 20, family: fonts.text, weight: '700' },
  caption: { size: 12, line: 16, family: fonts.text, weight: '600' }, // never below 12
  code: { size: 24, line: 32, family: fonts.text, weight: '600' }, // one digit in a code box
} as const;

export const sizes = {
  hitArea: 48,
  minVisual: 40,
  targetGap: 8,
  topBar: 56,
  iconButton: 48,
  tabBarContent: 56,
  tabBarTotal: 90, // 56 + 34 inset
  tabPill: { w: 56, h: 32 },
  button: { primary: 52, compact: 44, text: 48, compactMinWidth: 88, paddingX: 24 },
  input: { height: 52, paddingX: 20, textareaMin: 96, codeBox: { h: 56, minW: 48, gap: 8 } },
  chip: { height: 40, paddingX: 16, gap: 8 },
  tag: { height: 28, paddingX: 10 },
  segmented: { container: 52, segment: 44, padding: 4 },
  listRowMin: 56,
  avatar: { inline: 28, chatHeader: 36, sheet: 44, row: 48, profile: 72, thumbnail: 64 },
  icon: { tiny: 16, inline: 20, default: 24, feature: 32, stroke: 1.8 },
  photo: { heroW: 350, heroH: 437, slotW: 169, slotH: 211, feedMediaH: 300, ratio: '4:5' },
  sheet: { handle: { w: 40, h: 5 }, paddingTop: 12, paddingX: 20, maxHeightPct: 90 },
  switch: { w: 52, h: 32 },
  checkbox: 24,
  checkboxRadius: 6,
  optionCardMin: 64,
  progress: { height: 4, gap: 6 },
  chat: {
    bubbleMaxWidthPct: 78,
    bubbleRadius: 22,
    bubbleTailRadius: 6,
    bubblePaddingY: 10,
    bubblePaddingX: 14,
    bubbleLineHeight: 22,
    mediaMaxW: 240,
    composerInput: 48,
    composerPaddingY: 10,
    composerPaddingX: 12,
  },
  unreadDot: 10,
  tabBadge: { min: 20, paddingX: 4 }, // Count on a tab icon, orchid with white caption
} as const;

export const shadows = {
  card: { color: 'rgba(142,31,96,0.08)', offsetY: 8, blur: 24 },
  primaryButton: { color: 'rgba(204,46,134,0.28)', offsetY: 10, blur: 22 },
  tabBar: { color: 'rgba(142,31,96,0.10)', offsetY: -8, blur: 24 },
  sheet: { color: 'rgba(43,18,51,0.14)', offsetY: -8, blur: 30 },
  segment: { color: 'rgba(43,18,51,0.12)', offsetY: 1, blur: 3 },
} as const;
