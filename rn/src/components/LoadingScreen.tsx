import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors, Layout } from '@/constants/theme';

export const LoadingScreen: React.FC = () => (
  <View style={styles.root}>
    <ActivityIndicator color={Colors.primary} />
  </View>
);

const styles = StyleSheet.create({
  root: { ...Layout.fillCenter, backgroundColor: Colors.bgApp },
});
