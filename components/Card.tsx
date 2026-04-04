import { View, ViewProps, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';
import { Radii, Spacing, Shadows } from '../constants/Theme';

type CardVariant = 'elevated' | 'flat' | 'tinted';

type CardProps = ViewProps & {
  variant?: CardVariant;
  tintColor?: string;
  padding?: number;
};

export function Card({
  variant = 'elevated',
  tintColor,
  padding,
  style,
  ...props
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        variant === 'elevated' && styles.elevated,
        variant === 'flat' && styles.flat,
        variant === 'tinted' && [styles.tinted, tintColor ? { backgroundColor: tintColor } : null],
        padding !== undefined ? { padding } : null,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radii.lg,
    padding: Spacing.lg,
  },
  elevated: {
    backgroundColor: Colors.surface,
    ...Shadows.md,
  },
  flat: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tinted: {
    backgroundColor: Colors.primaryFaint,
  },
});
