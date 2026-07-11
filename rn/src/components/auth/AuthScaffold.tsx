import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import React from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Alpha, Colors, Gradients, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

interface AuthScaffoldProps {
  title: string;
  subtitle?: string;
  footerText: string;
  footerLinkText: string;
  footerHref: React.ComponentProps<typeof Link>['href'];
  children: React.ReactNode;
}

// Shared shell for the login/register screens: brand hero on the emerald
// gradient, with the form floating over its bottom edge in a shadow card.
// Kept deliberately compact so both forms fit on screen without scrolling.
export function AuthScaffold({ title, subtitle, footerText, footerLinkText, footerHref, children }: AuthScaffoldProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.five }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={Gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { paddingTop: insets.top + Spacing.five }]}
          >
            <View style={styles.logoTile}>
              <Image source={require('@/assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={styles.brandName}>toto.ai</Text>
          </LinearGradient>

          <View style={styles.card}>
            <Text style={[styles.title, !subtitle && styles.titleOnly]}>{title}</Text>
            {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            {children}
          </View>

          <Link href={footerHref} style={styles.link}>
            <Text style={styles.linkText}>
              {footerText} <Text style={styles.linkBold}>{footerLinkText}</Text>
            </Text>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// The card overlaps the hero's bottom edge; the hero keeps enough bottom
// padding that its gradient still shows behind the card's rounded corners.
const CARD_OVERLAP = Spacing.five;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: CARD_OVERLAP + Spacing.three,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  logoTile: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
    ...Shadows.float,
  },
  logo: { width: 36, height: 36 },
  brandName: { fontSize: 16, fontWeight: '800', color: Colors.white, letterSpacing: 0.3 },
  card: {
    marginTop: -CARD_OVERLAP,
    marginHorizontal: Spacing.three,
    padding: Spacing.three + Spacing.one,
    borderRadius: Radius.xl,
    backgroundColor: Colors.bgCard,
    ...Shadows.float,
  },
  title: { ...Typography.screenTitle, color: Colors.textPrimary, textAlign: 'center' },
  titleOnly: { marginBottom: Spacing.three },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.one,
    marginBottom: Spacing.three,
  },
  link: { alignSelf: 'center', marginTop: Spacing.three },
  linkText: { color: Colors.textSecondary, fontSize: 13 },
  linkBold: { color: Colors.primary, fontWeight: '700' },
});

// Form details shared by both auth screens so they stay visually in sync.
export const authFormStyles = StyleSheet.create({
  form: { gap: Spacing.two + Spacing.one },
  hint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  hintIcon: { marginTop: 1 },
  hintText: { flex: 1, fontSize: 11, lineHeight: 15, color: Colors.textSecondary },
  error: {
    color: Colors.errorText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    backgroundColor: `${Colors.red}${Alpha.wash}`,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
});
