import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { type LucideIcon } from 'lucide-react-native';

import { Alpha, Colors, Gradients, Layout, Radius } from '@/constants/theme';

interface IconBadgeProps {
  icon: LucideIcon;
  color?: string;
  size?: 32 | 36 | 40 | 44 | 48;
  iconSize?: number;
  /** Renders the badge as a filled brand-gradient square with a white icon
   * instead of the default tinted wash — for hero/CTA emphasis. */
  gradient?: boolean;
}

export const IconBadge: React.FC<IconBadgeProps> = ({ icon: Icon, color = Colors.primary, size = 36, iconSize, gradient }) => {
  const resolvedIconSize = iconSize ?? Math.round(size * 0.45);
  const shape = { width: size, height: size, borderRadius: size >= 40 ? Radius.md : Radius.sm };

  if (gradient) {
    return (
      <LinearGradient
        colors={Gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.badge, shape]}
      >
        <Icon size={resolvedIconSize} color={Colors.white} />
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.badge, shape, { backgroundColor: `${color}${Alpha.tint}` }]}>
      <Icon size={resolvedIconSize} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { ...Layout.center },
});
