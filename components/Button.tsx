import { StyleSheet, Pressable, PressableProps, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { Fonts, Radii, Spacing } from '../constants/Theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = Omit<PressableProps, 'style'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <AnimatedPressable
      style={[
        styles.base,
        variantStyle.container,
        sizeStyle.container,
        (disabled || loading) && styles.disabled,
        animatedStyle,
      ]}
      onPressIn={() => { scale.value = withSpring(0.97, { damping: 15, stiffness: 300 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#fff' : Colors.primary}
        />
      ) : (
        <Animated.Text style={[styles.text, variantStyle.text, sizeStyle.text]}>
          {children}
        </Animated.Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.lg,
  },
  text: {
    fontFamily: Fonts.bold,
  },
  disabled: {
    opacity: 0.5,
  },
});

const variantStyles = {
  primary: {
    container: {
      backgroundColor: Colors.primary,
    } as const,
    text: {
      color: '#FFFFFF',
    } as const,
  },
  secondary: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: Colors.primary,
    } as const,
    text: {
      color: Colors.primary,
    } as const,
  },
  ghost: {
    container: {
      backgroundColor: 'transparent',
    } as const,
    text: {
      color: Colors.primary,
    } as const,
  },
  danger: {
    container: {
      backgroundColor: Colors.error,
    } as const,
    text: {
      color: '#FFFFFF',
    } as const,
  },
};

const sizeStyles = {
  sm: {
    container: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
    } as const,
    text: {
      fontSize: 14,
    } as const,
  },
  md: {
    container: {
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
    } as const,
    text: {
      fontSize: 16,
    } as const,
  },
  lg: {
    container: {
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing['2xl'],
    } as const,
    text: {
      fontSize: 17,
    } as const,
  },
};
