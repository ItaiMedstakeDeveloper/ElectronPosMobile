import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, usePathname } from 'expo-router';
import { colors } from '@/theme';
import { bottomTabsFor } from '@/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(href + '/');

// Compact bottom bar shown on narrow (mobile) layouts: the primary screens plus
// a "More" button that opens the slide-out drawer.
export function BottomTabs({ onMore, moreActive }: { onMore: () => void; moreActive?: boolean }) {
  const pathname = usePathname();
  const { count } = useCart();
  const { role } = useAuth();
  const bottomTabs = bottomTabsFor(role);

  const anyPrimaryActive = bottomTabs.some((t) => isActive(pathname, t.href));
  const moreHighlight = moreActive || !anyPrimaryActive;

  return (
    <View style={s.bar}>
      {bottomTabs.map((tab) => {
        const active = isActive(pathname, tab.href);
        const color = active ? colors.primary : colors.textMuted;
        const badge = tab.href === '/cart' && count > 0 ? count : undefined;
        return (
          <Link key={tab.href} href={tab.href as any} asChild>
            <Pressable style={s.tab}>
              <View style={[s.iconWrap, active && s.iconWrapActive]}>
                <Ionicons name={tab.icon} size={22} color={color} />
                {badge ? (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[s.label, active && s.labelActive]}>{tab.label}</Text>
            </Pressable>
          </Link>
        );
      })}

      <Pressable style={s.tab} onPress={onMore}>
        <View style={[s.iconWrap, moreHighlight && s.iconWrapActive]}>
          <Ionicons name="menu" size={22} color={moreHighlight ? colors.primary : colors.textMuted} />
        </View>
        <Text style={[s.label, moreHighlight && s.labelActive]}>More</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 8,
    paddingTop: 8,
    paddingHorizontal: 6,
    gap: 4,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  iconWrap: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 999 },
  iconWrapActive: { backgroundColor: colors.primarySoft },
  label: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  labelActive: { color: colors.primary, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -4,
    right: 4,
    backgroundColor: colors.accent,
    borderRadius: 999,
    minWidth: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#2b2b2b' },
});
