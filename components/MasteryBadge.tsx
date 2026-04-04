import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Fonts } from '../constants/Theme';
import { Caption } from './Typography';
import type { MasteryLevel } from '../lib/srs';

const MASTERY_CONFIG: Record<MasteryLevel, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  seedling: { icon: 'leaf', color: Colors.seedling, label: 'Seedling' },
  growing: { icon: 'trending-up', color: Colors.growing, label: 'Growing' },
  rooted: { icon: 'shield-checkmark', color: Colors.rooted, label: 'Rooted' },
  'deep-rooted': { icon: 'trophy', color: Colors.deepRooted, label: 'Deep-Rooted' },
};

type MasteryBadgeProps = {
  level: MasteryLevel;
  showLabel?: boolean;
  size?: number;
};

export function MasteryBadge({ level, showLabel = false, size = 16 }: MasteryBadgeProps) {
  const config = MASTERY_CONFIG[level];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconContainer,
          {
            width: size * 1.5,
            height: size * 1.5,
            borderRadius: size * 0.75,
            backgroundColor: config.color + '1F',
          },
        ]}
      >
        <Ionicons name={config.icon} size={size} color={config.color} />
      </View>
      {showLabel && (
        <Caption style={{ color: config.color }}>{config.label}</Caption>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
