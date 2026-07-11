import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';

export const LoadingScreen: React.FC = () => (
  <View style={styles.root}>
    <ActivityIndicator color={Colors.primary} />
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgApp },
});
