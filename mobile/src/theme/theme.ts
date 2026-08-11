// Fwitter design tokens (dark theme) — the single source of truth for colors,
// type, spacing and radii, extracted from the Fwitter.dc.html prototype.
// Screens should pull from here rather than hardcoding values.

export const colors = {
  // Accents
  accent: '#00C853', // primary green
  accentText: '#06210F', // text/icons sitting on top of `accent`
  accent2: '#00AAFF', // secondary blue (checking state, info, verified)

  // Surfaces
  bg: '#0D0D0D', // app background
  surface: '#121212', // inputs
  surface2: '#141414', // cards, sheets, secondary buttons
  surface3: '#161616', // chips, subtle fills

  // Lines
  border: '#2a2a2a', // input / control borders
  borderSubtle: '#242424', // card borders
  divider: '#1a1a1a', // section dividers
  rowDivider: '#161616', // list-row dividers

  // Text
  text: '#ffffff', // headings / strong
  textBody: '#e8e8e8', // body copy
  textMuted: '#9a9a9a',
  textDim: '#7a7a7a',
  textFaint: '#6a6a6a',
  placeholder: '#5a5a5a',

  // Status
  danger: '#ea3333',
  warn: '#ffb020',
  success: '#00C853',
} as const;

// Font family names as loaded in app/_layout.tsx via @expo-google-fonts.
export const fonts = {
  display: 'RobotoCondensed_900Black', // big uppercase display headings
  heading: 'RobotoCondensed_700Bold', // section headings, buttons
  body: 'Roboto_400Regular',
  bodyMedium: 'Roboto_500Medium',
  bodyBold: 'Roboto_700Bold',
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const theme = { colors, fonts, spacing, radii } as const;
export default theme;
