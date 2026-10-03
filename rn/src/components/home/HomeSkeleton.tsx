import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skeleton } from '@/components/Skeleton';
import { Colors, Layout, Radius, Shadows, Spacing } from '@/constants/theme';

// Mirrors the dashboard's layout (greeting → hero card → summarize CTA →
// section grids) so the real content pops in without the page reflowing.
export const HomeSkeleton: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.three }]}>
      <Skeleton width={140} height={12} />
      <Skeleton width={220} height={26} />

      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTitleBlock}>
            <Skeleton width={110} height={12} style={styles.onHero} />
            <Skeleton width={80} height={30} style={styles.onHero} />
          </View>
          <Skeleton width={120} height={30} radius={Radius.pill} style={styles.onHero} />
        </View>
        <Skeleton height={8} radius={Radius.pill} style={styles.onHero} />
        <View style={styles.tileGrid}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height={56} radius={Radius.md} style={[styles.gridTile, styles.onHero]} />
          ))}
        </View>
      </View>

      <View style={styles.ctaCard}>
        <Skeleton width={40} height={40} radius={Radius.pill} />
        <View style={styles.ctaBody}>
          <Skeleton width="70%" height={14} />
          <Skeleton width="90%" height={11} />
        </View>
      </View>

      {Array.from({ length: 2 }, (_, section) => (
        <React.Fragment key={section}>
          <Skeleton width={120} height={12} style={styles.sectionLabel} />
          <View style={styles.tileGrid}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height={72} radius={Radius.lg} style={styles.gridTile} />
            ))}
          </View>
        </React.Fragment>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgApp,
    padding: Spacing.three,
    gap: Spacing.three,
    overflow: 'hidden',
  },
  heroCard: {
    gap: Spacing.three,
    borderRadius: Radius.xl,
    padding: Spacing.three,
    backgroundColor: Colors.zinc200,
  },
  heroHeader: { ...Layout.rowBetween },
  heroTitleBlock: { gap: Spacing.two },
  // Blocks sitting on the (already gray) hero card need a darker tone to read.
  onHero: { backgroundColor: Colors.zinc300 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  gridTile: { flexGrow: 1, flexBasis: '45%' },
  ctaCard: {
    ...Layout.row,
    gap: Spacing.two,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    ...Shadows.card,
  },
  ctaBody: { flex: 1, gap: 6 },
  sectionLabel: { marginTop: Spacing.two },
});
