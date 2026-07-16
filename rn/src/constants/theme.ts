/**
 * Color tokens originally mirrored from web/src/index.css (`:root` custom
 * properties); the mobile app has since diverged toward a softer, more
 * expressive look (tinted surfaces, gradients) while keeping the same
 * `primary` brand color. The web app only ships a light theme, so this app
 * does too — no dark mode branching.
 */
export const Colors = {
  primary: '#059669',
  // Shades of the brand emerald used by gradients/pressed states — `primary`
  // itself is the single source of truth for the brand hue.
  primaryDeep: '#047857',
  primaryBright: '#10b981',
  primaryForeground: '#ffffff',
  bgApp: '#f2f5f3',
  bgSidebar: '#ffffff',
  bgCard: '#ffffff',
  border: '#e2e6e3',
  textPrimary: '#1d1d1f',
  textSecondary: '#6e6e73',
  white: '#ffffff',

  // Semantic colors used by content-type accents (mirrors web usage of
  // red-500/amber-500/emerald/etc. Tailwind utilities).
  red: '#ef4444',
  amber: '#f59e0b',
  blue: '#3b82f6',
  orange: '#f97316',
  purple: '#a855f7',
  emerald: '#10b981',
  teal: '#14b8a6',
  yellow: '#eab308',
  zinc200: '#e4e4e7',
  zinc300: '#d4d4d8',

  // Distinct from `red` — used for inline form/validation error text.
  errorText: '#dc2626',
  // Leaderboard rank 2/3 accents (rank 1 uses `amber`).
  silver: '#9ca3af',
  bronze: '#b45309',
} as const;

// Gradient stop tuples for `expo-linear-gradient` (`colors` prop needs a
// readonly tuple of at least two ColorValues). Render diagonally by default:
// start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}.
export const Gradients = {
  // Brand emerald — primary buttons, active chips, small accents.
  primary: ['#10b981', '#059669'],
  // Deeper emerald→teal sweep — hero cards, screen headers.
  hero: ['#047857', '#059669', '#0d9488'],
  // Warm accent — XP / streak / celebration surfaces.
  amber: ['#fbbf24', '#f59e0b'],
  sunset: ['#fb923c', '#f43f5e'],
  // Cool accents for feature tiles.
  sky: ['#38bdf8', '#3b82f6'],
  violet: ['#a78bfa', '#8b5cf6'],
  // Soft mint page wash — full-screen backdrops (auth, hubs).
  page: ['#d9f2e6', '#f2f5f3', '#f2f5f3'],
  // Barely-there surface sheen for light cards.
  mintSurface: ['#ecfdf5', '#ffffff'],
} as const;

// Modal/lightbox backdrop tints — kept separate from `Colors` since they're
// translucent overlays, not surface/text colors.
export const Overlay = {
  backdrop: 'rgba(0,0,0,0.4)',
  backdropDark: 'rgba(0,0,0,0.9)',
  // Near-opaque floating panel (e.g. controls/badges over a WebView canvas).
  panel: 'rgba(255,255,255,0.92)',
  // Frosted-glass fills for elements sitting on a Gradients.* background.
  glass: 'rgba(255,255,255,0.16)',
  glassStrong: 'rgba(255,255,255,0.28)',
  glassBorder: 'rgba(255,255,255,0.35)',
  // Secondary text on a gradient background (white is the primary).
  onGradientMuted: 'rgba(255,255,255,0.78)',
} as const;

// Hex alpha suffixes for tinting a `Colors` value (e.g. `${Colors.primary}${Alpha.tint}`).
// Named tiers replace the ad hoc '0d'/'1a'/'22' suffixes used inconsistently across screens.
export const Alpha = {
  wash: '0d',
  tint: '1a',
  strong: '33',
} as const;

// Soft elevation presets — cards float on shadows instead of hard borders.
export const Shadows = {
  card: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  float: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  // Colored glow under brand-gradient elements (primary buttons, hero cards).
  primaryGlow: {
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  // Fully-rounded chips/pills/buttons.
  pill: 999,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

// Motion tokens for `react-native-reanimated`. Animations run on the UI thread,
// so they keep going while JS is busy (list fetches, AI streaming) — the reason
// press/entrance feedback here is Reanimated rather than RN's `Animated`.
//
// Durations are deliberately short: this is a study app, and motion is there to
// explain what moved where, not to make the user wait for it.
export const Motion = {
  duration: {
    /** Press in/out, chip toggles — must feel instant. */
    instant: 120,
    /** Default for most state changes (progress fills, fades). */
    base: 240,
    /** Entrances, flips — long enough to read as a movement. */
    slow: 380,
  },
  /** Per-item offset for staggered list/section entrances. Beyond ~8 items the
   *  cumulative delay gets noticeable, so callers cap the index (see `stagger`). */
  stagger: (index: number, step = 45) => Math.min(index, 7) * step,
  spring: {
    /** Press feedback — critically damped, no visible bounce. */
    press: { damping: 18, stiffness: 320, mass: 0.6 },
    /** Selections/reveals — a little overshoot reads as responsive. */
    bouncy: { damping: 12, stiffness: 180, mass: 0.8 },
    /** Card flip — heavier, so the rotation settles rather than wobbles. */
    flip: { damping: 16, stiffness: 120, mass: 0.9 },
  },
  /** Scale a Pressable settles to while held. */
  pressScale: 0.97,
} as const;

// Layout idioms that were being re-declared in nearly every StyleSheet
// (`flexDirection: 'row'` alone appeared 200+ times). Spread these instead:
// `row: { ...Layout.row, gap: Spacing.two }`.
export const Layout = {
  row: { flexDirection: 'row', alignItems: 'center' },
  /** Row with its children pushed to the two edges. */
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  /** Row that wraps — tile grids, stat rows. */
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  /** Fills its parent and centers a single child (loading/empty screens). */
  fillCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
} as const;

// Font size/weight scale distilled from sizes already hardcoded ad hoc across
// existing screens (e.g. LibraryScreen's 22/800 header, TextField's 12/700 label).
export const Typography = {
  title: { fontSize: 26, fontWeight: '800' as const },
  // Screen/nav-adjacent title (library header, auth headline, document/video
  // title) — was 5 different ad hoc sizes (18-24px) across screens; normalized
  // to the most common of those values rather than inventing a new one.
  screenTitle: { fontSize: 20, fontWeight: '800' as const },
  heading: { fontSize: 20, fontWeight: '700' as const },
  subheading: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyBold: { fontSize: 15, fontWeight: '700' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  captionBold: { fontSize: 12, fontWeight: '700' as const },
} as const;
