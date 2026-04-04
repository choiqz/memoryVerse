import { useEffect } from 'react';
import { TextProps, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  useDerivedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { useState, useCallback } from 'react';
import { Fonts } from '../constants/Theme';
import { Colors } from '../constants/Colors';
import { Title } from './Typography';

type AnimatedCounterProps = {
  value: number;
  duration?: number;
  delay?: number;
  prefix?: string;
  suffix?: string;
  style?: TextProps['style'];
  color?: string;
};

export function AnimatedCounter({
  value,
  duration = 800,
  delay = 0,
  prefix = '',
  suffix = '',
  style,
  color,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const animatedValue = useSharedValue(0);

  const updateDisplay = useCallback((v: number) => {
    setDisplayValue(Math.round(v));
  }, []);

  useDerivedValue(() => {
    runOnJS(updateDisplay)(animatedValue.value);
  });

  useEffect(() => {
    const timeout = setTimeout(() => {
      animatedValue.value = withTiming(value, {
        duration,
        easing: Easing.out(Easing.quad),
      });
    }, delay);
    return () => clearTimeout(timeout);
  }, [value, duration, delay]);

  return (
    <Title style={[color ? { color } : null, style]}>
      {prefix}{displayValue}{suffix}
    </Title>
  );
}
