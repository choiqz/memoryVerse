export const Colors = {
  primary: '#8B5CF6',
  primaryLight: '#C4B5FD',
  primaryDark: '#6D28D9',
  primaryFaint: '#EDE9FE',
  secondary: '#F59E0B',
  secondaryLight: '#FCD34D',
  xp: '#FBBF24',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  streak: '#F97316',
  streakLight: '#FFF7ED',
  success: '#22C55E',
  successLight: '#DCFCE7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  text: '#18181B',
  textSecondary: '#52525B',
  textMuted: '#52525B',     // alias for textSecondary
  textTertiary: '#A1A1AA',
  textLight: '#A1A1AA',     // alias for textTertiary
  border: '#E4E4E7',
  divider: '#F4F4F5',
  // Mastery level colors
  seedling: '#22C55E',
  growing: '#3B82F6',
  rooted: '#8B5CF6',
  deepRooted: '#F59E0B',
} as const;

export type ColorKey = keyof typeof Colors;
