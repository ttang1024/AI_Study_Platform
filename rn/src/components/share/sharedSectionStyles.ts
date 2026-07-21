import { StyleSheet } from 'react-native';
import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';

/** Shared "card with a small caps label" look used by every tab body in the share screen. */
export const sharedSectionStyles = StyleSheet.create({
  sectionCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two, ...Shadows.card,
  },
  sectionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: Colors.primary },
});
