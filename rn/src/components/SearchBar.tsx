import React from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { Search } from 'lucide-react-native';

import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  returnKeyType?: TextInputProps['returnKeyType'];
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChangeText, placeholder = 'Search…', onSubmitEditing, returnKeyType }) => (
  <View style={styles.root}>
    <Search size={16} color={Colors.primary} />
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textSecondary}
      style={styles.input}
      onSubmitEditing={onSubmitEditing}
      returnKeyType={returnKeyType}
    />
  </View>
);

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.bgSidebar,
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    height: 46,
    ...Shadows.card,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
  },
});
