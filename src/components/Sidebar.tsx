import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, radius } from '@/theme';
import { NavMenu } from '@/components/NavMenu';
import { useAuth, roleLabel } from '@/context/AuthContext';

const initials = (s?: string | null) => {
  const v = (s || '').trim();
  if (!v) return 'U';
  const parts = v.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || v[0].toUpperCase();
};

// Persistent left rail shown on wide (desktop) layouts.
export function Sidebar() {
  const router = useRouter();
  const { role, user, signOut } = useAuth();

  const logout = () => {
    signOut();
    router.replace('/');
  };

  return (
    <View style={s.sidebar}>
      <View style={s.brand}>
        <View style={s.logo}>
          <Ionicons name="flash" size={20} color="#2b2b2b" />
        </View>
        <View>
          <Text style={s.brandText}>Electron POS</Text>
          <Text style={s.brandSub}>Point of Sale</Text>
        </View>
      </View>

      <ScrollView style={s.nav} contentContainerStyle={s.navContent} showsVerticalScrollIndicator={false}>
        <NavMenu dark />
      </ScrollView>

      <View style={s.account}>
        <View style={s.accountRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials(user?.name || user?.email)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.accountName} numberOfLines={1}>
              {user?.name || user?.email || 'Signed in'}
            </Text>
            <Text style={s.accountRole}>{role ? roleLabel[role] : ''}</Text>
          </View>
        </View>
        <Pressable style={s.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color="#cfd2d6" />
          <Text style={s.logoutText}>Sign Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  sidebar: {
    width: 264,
    backgroundColor: colors.sidebar,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.lg,
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { color: colors.textOnDark, fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  brandSub: { color: '#9a9da1', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  nav: { flex: 1 },
  navContent: { paddingBottom: spacing.md },
  account: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.sidebarHover,
    gap: spacing.sm,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  accountName: { color: colors.textOnDark, fontSize: 13, fontWeight: '600' },
  accountRole: { color: '#9a9da1', fontSize: 12 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  logoutText: { color: '#cfd2d6', fontSize: 15, fontWeight: '500' },
});
