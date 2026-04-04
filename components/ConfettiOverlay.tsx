import { useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PARTICLE_COUNT = 50;
const COLORS = ['#8B5CF6', '#F59E0B', '#22C55E', '#F97316', '#EC4899', '#06B6D4'];

type ParticleConfig = {
  startX: number;
  startY: number;
  endY: number;
  driftX: number;
  rotation: number;
  size: number;
  color: string;
  isCircle: boolean;
  duration: number;
  delay: number;
};

function generateParticles(): ParticleConfig[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    startX: Math.random() * SCREEN_WIDTH,
    startY: -(Math.random() * 60 + 20),
    endY: SCREEN_HEIGHT + 100,
    driftX: (Math.random() - 0.5) * 120,
    rotation: Math.random() * 720 - 360,
    size: Math.random() * 6 + 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    isCircle: Math.random() > 0.5,
    duration: Math.random() * 800 + 1200,
    delay: Math.random() * 300,
  }));
}

function Particle({ config, trigger }: { config: ParticleConfig; trigger: SharedValue<number> }) {
  const animatedStyle = useAnimatedStyle(() => {
    if (trigger.value === 0) {
      return { opacity: 0 };
    }

    return {
      opacity: 1,
      transform: [
        { translateX: config.startX + config.driftX * trigger.value },
        { translateY: config.startY + (config.endY - config.startY) * trigger.value },
        { rotate: `${config.rotation * trigger.value}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: config.size,
          height: config.isCircle ? config.size : config.size * 0.6,
          backgroundColor: config.color,
          borderRadius: config.isCircle ? config.size / 2 : 2,
        },
        animatedStyle,
      ]}
    />
  );
}

export type ConfettiRef = {
  fire: () => void;
};

export const ConfettiOverlay = forwardRef<ConfettiRef>(function ConfettiOverlay(_, ref) {
  const [particles] = useState(() => generateParticles());
  const [visible, setVisible] = useState(false);
  const trigger = useSharedValue(0);

  const hide = useCallback(() => {
    setVisible(false);
  }, []);

  const fire = useCallback(() => {
    setVisible(true);
    trigger.value = 0;
    trigger.value = withTiming(1, {
      duration: 2000,
      easing: Easing.in(Easing.quad),
    }, (finished) => {
      if (finished) {
        runOnJS(hide)();
      }
    });
  }, []);

  useImperativeHandle(ref, () => ({ fire }), [fire]);

  if (!visible) return null;

  return (
    <Animated.View style={styles.overlay} pointerEvents="none">
      {particles.map((config, i) => (
        <Particle key={i} config={config} trigger={trigger} />
      ))}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
});
