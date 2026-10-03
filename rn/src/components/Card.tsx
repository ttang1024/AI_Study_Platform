import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';

export const Card: React.FC<ViewProps> = ({ style, ...rest }) => (
  <View style={[styles.card, style]} {...rest} />
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    ...Shadows.card,
  },
});
