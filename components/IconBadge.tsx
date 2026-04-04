import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IconBadgeProps = {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size?: number;
  bgOpacity?: number;
};

export function IconBadge({ name, color, size = 20, bgOpacity = 0.12 }: IconBadgeProps) {
  const containerSize = size * 2;

  return (
    <View
      style={[
        styles.container,
        {
          width: containerSize,
          height: containerSize,
          borderRadius: containerSize / 2,
          backgroundColor: color + Math.round(bgOpacity * 255).toString(16).padStart(2, '0'),
        },
      ]}
    >
      <Ionicons name={name} size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
