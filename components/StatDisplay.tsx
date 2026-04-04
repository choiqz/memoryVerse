import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IconBadge } from './IconBadge';
import { Colors } from '../constants/Colors';
import { Fonts, Spacing } from '../constants/Theme';
import { Title, Overline } from './Typography';

type StatDisplayProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: string | number;
  label: string;
};

export function StatDisplay({ icon, iconColor, value, label }: StatDisplayProps) {
  return (
    <View style={styles.container}>
      <IconBadge name={icon} color={iconColor} size={16} />
      <View style={styles.text}>
        <Title style={styles.value}>{value}</Title>
        <Overline>{label}</Overline>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  text: {
    gap: 2,
  },
  value: {
    fontSize: 18,
    lineHeight: 22,
  },
});
