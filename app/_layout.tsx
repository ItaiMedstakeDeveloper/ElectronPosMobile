import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { DataProvider } from '@/context/DataContext';
import { ShopProvider, useShop } from '@/context/ShopContext';
import { LicenseProvider } from '@/context/LicenseContext';
import { colors } from '@/theme';

// The data stack (data + cart) is scoped to the active shop. It only mounts once
// the shop layer is ready, and it is KEYED on the active shop id so switching a
// shop remounts it — re-initialising the DB against the new shop's file and
// reloading everything. The signed-in owner (AuthProvider) sits outside that key
// so they stay signed in across shop switches.
function ShopScopedApp() {
  const { ready, activeShopId } = useShop();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    // LicenseProvider is device-wide (trial + licence), so it sits OUTSIDE the
    // shop key — switching shops must not reset the trial countdown.
    <LicenseProvider>
      <DataProvider key={activeShopId ?? 'none'}>
        <CartProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          />
        </CartProvider>
      </DataProvider>
    </LicenseProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ShopProvider>
        <AuthProvider>
          <ShopScopedApp />
        </AuthProvider>
      </ShopProvider>
    </SafeAreaProvider>
  );
}
