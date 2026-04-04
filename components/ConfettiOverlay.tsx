import { useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PARTICLE_COUNT = 30;
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
  speedFactor: number;
};

function generateParticles(): ParticleConfig[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    startX: SCREEN_WIDTH * 0.3 + Math.random() * SCREEN_WIDTH * 0.4,
    startY: SCREEN_HEIGHT * 0.15,
    endY: SCREEN_HEIGHT + 50,
    driftX: (Math.random() - 0.5) * 200,
    rotation: Math.random() * 720 - 360,
    size: Math.random() * 6 + 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    isCircle: Math.random() > 0.5,
    speedFactor: 0.75 + Math.random() * 0.5,
  }));
}

function Particle({ config, trigger }: { config: ParticleConfig; trigger: SharedValue<number> }) {
  const animatedStyle = useAnimatedStyle(() => {
    if (trigger.value === 0) {
      return { opacity: 0 };
    }

    const progress = Math.min(trigger.value / config.speedFactor, 1);
    const opacity = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;

    return {
      opacity,
      transform: [
        { translateX: config.startX + config.driftX * progress },
        { translateY: config.startY + (config.endY - config.startY) * progress },
        { rotate: `${config.rotation * progress}deg` },
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
  const [particles, setParticles] = useState(() => generateParticles());
  const [visible, setVisible] = useState(false);
  const trigger = useSharedValue(0);

  const hide = useCallback(() => {
    setVisible(false);
  }, []);

  const fire = useCallback(() => {
    setParticles(generateParticles());
    setVisible(true);
    trigger.value = 0;
    trigger.value = withTiming(1, {
      duration: 1600,
      easing: Easing.out(Easing.cubic),
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
