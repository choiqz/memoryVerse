import { Text, TextProps, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';
import { Fonts } from '../constants/Theme';

type TypographyProps = TextProps & {
  color?: string;
};

export function Display({ style, color, ...props }: TypographyProps) {
  return <Text style={[styles.display, color ? { color } : null, style]} {...props} />;
}

export function Heading({ style, color, ...props }: TypographyProps) {
  return <Text style={[styles.heading, color ? { color } : null, style]} {...props} />;
}

export function Title({ style, color, ...props }: TypographyProps) {
  return <Text style={[styles.title, color ? { color } : null, style]} {...props} />;
}

export function Body({ style, color, ...props }: TypographyProps) {
  return <Text style={[styles.body, color ? { color } : null, style]} {...props} />;
}

export function Caption({ style, color, ...props }: TypographyProps) {
  return <Text style={[styles.caption, color ? { color } : null, style]} {...props} />;
}

export function Overline({ style, color, ...props }: TypographyProps) {
  return <Text style={[styles.overline, color ? { color } : null, style]} {...props} />;
}

const styles = StyleSheet.create({
  display: {
    fontFamily: Fonts.extraBold,
    fontSize: 30,
    lineHeight: 36,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  heading: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 17,
    lineHeight: 22,
    color: Colors.text,
  },
  body: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
  },
  caption: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  overline: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
