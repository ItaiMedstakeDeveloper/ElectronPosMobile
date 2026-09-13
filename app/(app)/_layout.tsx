import React, { useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Slot, Redirect, usePathname } from 'expo-router';
import { Sidebar } from '@/components/Sidebar';
import { BottomTabs } from '@/components/BottomTabs';
import { MobileDrawer } from '@/components/MobileDrawer';
import { BREAKPOINT_WIDE, colors } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { useLicense } from '@/context/LicenseContext';
import { canAccess, homeFor } from '@/navigation';

// Chrome for the authenticated POS. Wide screens get the persistent side rail;
// narrow (mobile) screens get the bottom tab bar plus a slide-out drawer.
export default function AppLayout() {
  const { role } = useAuth();
  const { status: licenseStatus, trialStarted } = useLicense();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const wide = width >= BREAKPOINT_WIDE;
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Any navigation (including from the drawer) dismisses it.
  useEffect(() => setDrawerOpen(false), [pathname]);

  // Collapsing to a wide layout should never leave the mobile drawer open.
  useEffect(() => {
    if (wide) setDrawerOpen(false);
  }, [wide]);

  // Guard: no session -> back to the sign-in screen.
  if (!role) return <Redirect href="/" />;

  // Trial/licence gate: a signed-in user on an unlicensed device that hasn't
  // started its free trial is sent to the trial offer — so it appears both right
  // after registration AND on later logins, until the trial is started (or a
  // paid licence is active). We wait for the licence check to finish ('loading')
  // to avoid briefly flashing the offer to users who already have a trial.
  if (licenseStatus !== 'loading' && licenseStatus !== 'active' && !trialStarted) {
    return <Redirect href={'/trial' as any} />;
  }

  // Role guard: keep cashiers in the checkout flow and user management admin-only.
  // Redirect any disallowed screen to the role's home.
  if (!canAccess(role, pathname)) return <Redirect href={homeFor(role) as any} />;

  return (
    <SafeAreaView style={s.root} edges={wide ? ['top', 'bottom'] : ['top']}>
      {wide ? (
        <View style={s.rowLayout}>
          <Sidebar />
          <View style={s.content}>
            <Slot />
          </View>
        </View>
      ) : (
        <>
          <View style={s.colLayout}>
            <View style={s.content}>
              <Slot />
            </View>
            <BottomTabs onMore={() => setDrawerOpen(true)} moreActive={drawerOpen} />
          </View>
          <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  rowLayout: { flex: 1, flexDirection: 'row' },
  colLayout: { flex: 1, flexDirection: 'column' },
  content: { flex: 1 },
});
