import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { Radii } from '../constants/Theme';

type ProgressBarProps = {
  progress: number; // 0 to 1
  height?: number;
  color?: string;
  trackColor?: string;
};

export function ProgressBar({
  progress,
  height = 6,
  color = Colors.primary,
  trackColor = Colors.divider,
}: ProgressBarProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    width: withTiming(`${Math.min(Math.max(progress, 0), 1) * 100}%` as any, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    }),
  }));

  return (
    <View style={[styles.track, { height, backgroundColor: trackColor, borderRadius: height / 2 }]}>
      <Animated.View
        style={[
          styles.fill,
          { height, backgroundColor: color, borderRadius: height / 2 },
          animatedStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
