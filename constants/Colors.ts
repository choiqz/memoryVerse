export const Colors = {
  primary: '#7C3AED',      // purple
  primaryLight: '#A78BFA',
  primaryDark: '#5B21B6',
  secondary: '#F59E0B',    // amber/gold
  secondaryLight: '#FCD34D',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  streak: '#FF6B35',       // orange flame
  streakLight: '#FFE5D9',
  success: '#10B981',      // emerald
  successLight: '#D1FAE5',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  text: '#1F2937',
  textMuted: '#6B7280',
  textLight: '#9CA3AF',
  border: '#E5E7EB',
  divider: '#F3F4F6',
  // Mastery level colors
  seedling: '#10B981',
  growing: '#3B82F6',
  rooted: '#8B5CF6',
  deepRooted: '#F59E0B',
} as const;

export type ColorKey = keyof typeof Colors;
