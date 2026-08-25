import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link, Redirect } from 'expo-router';
import { Button, TextField } from '@/components/ui';
import { colors, spacing, radius } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { homeFor } from '@/navigation';

type Tab = 'admin' | 'cashier';

export default function SignIn() {
  const router = useRouter();
  const { role, signInAdmin, signInCashier } = useAuth();
  const [tab, setTab] = useState<Tab>('admin');

  // Admin fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Cashier fields
  const [phone, setPhone] = useState('');
  const [passcode, setPasscode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in → bounce to the right home for the role.
  if (role) return <Redirect href={homeFor(role) as any} />;

  const switchTab = (t: Tab) => {
    setTab(t);
    setError(null);
  };

  const loginAdmin = async () => {
    setError(null);
    setBusy(true);
    const res = await signInAdmin(email, password);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.replace(homeFor(res.user.role) as any);
  };

  const loginCashier = async () => {
    setError(null);
    setBusy(true);
    const res = await signInCashier(phone, passcode);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.replace(homeFor(res.user.role) as any);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.card}>
            <View style={s.brand}>
              <View style={s.logo}>
                <Ionicons name="flash" size={26} color={colors.accent} />
              </View>
              <Text style={s.brandText}>Electron POS</Text>
              <Text style={s.brandSub}>Sign in to your point of sale</Text>
            </View>

            {/* Admin / Cashier segmented control */}
            <View style={s.segment}>
              <SegmentButton
                label="Admin"
                icon="shield-checkmark-outline"
                active={tab === 'admin'}
                onPress={() => switchTab('admin')}
              />
              <SegmentButton
                label="Cashier"
                icon="person-outline"
                active={tab === 'cashier'}
                onPress={() => switchTab('cashier')}
              />
            </View>

            {tab === 'admin' ? (
              <View style={s.form}>
                <TextField
                  label="Email"
                  icon="mail-outline"
                  placeholder="you@company.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    setError(null);
                  }}
                />
                <TextField
                  label="Password"
                  icon="lock-closed-outline"
                  placeholder="••••••••"
                  secureTextEntry
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    setError(null);
                  }}
                />
                {error ? <ErrorNote text={error} /> : null}
                <Button
                  title={busy ? 'Signing in…' : 'Log In'}
                  icon="log-in-outline"
                  onPress={loginAdmin}
                  disabled={busy}
                />
                <View style={s.footerRow}>
                  <Text style={s.footerText}>Don't have an account?</Text>
                  <Link href="/signup" asChild>
                    <Pressable>
                      <Text style={s.link}>Register</Text>
                    </Pressable>
                  </Link>
                </View>
              </View>
            ) : (
              <View style={s.form}>
                <TextField
                  label="Phone Number"
                  icon="call-outline"
                  placeholder="+263 77 123 4567"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(v) => {
                    setPhone(v);
                    setError(null);
                  }}
                />
                <TextField
                  label="Passcode"
                  icon="keypad-outline"
                  placeholder="Up to 6 digits"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  value={passcode}
                  onChangeText={(v) => {
                    // Digits only, capped at 6.
                    setPasscode(v.replace(/[^0-9]/g, '').slice(0, 6));
                    setError(null);
                  }}
                />
                {error ? <ErrorNote text={error} /> : null}
                <Button
                  title={busy ? 'Signing in…' : 'Log In'}
                  icon="log-in-outline"
                  onPress={loginCashier}
                  disabled={busy}
                />
                <Text style={s.hint}>
                  Cashiers sign in with their phone number and passcode.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ErrorNote({ text }: { text: string }) {
  return (
    <View style={s.errorBox}>
      <Ionicons name="alert-circle" size={16} color={colors.danger} />
      <Text style={s.errorText}>{text}</Text>
    </View>
  );
}

function SegmentButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={StyleSheet.flatten([s.segBtn, active && s.segBtnActive])} onPress={onPress}>
      <Ionicons name={icon} size={16} color={active ? colors.text : colors.textMuted} />
      <Text style={[s.segText, active && s.segTextActive]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sidebar },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  brand: { alignItems: 'center', gap: 6 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.sidebar,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  brandText: { fontSize: 22, fontWeight: '800', color: colors.text },
  brandSub: { fontSize: 14, color: colors.textMuted },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  segBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  segTextActive: { color: colors.text },
  form: { gap: spacing.md },
  footerRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 2 },
  footerText: { color: colors.textMuted, fontSize: 14 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fdecec',
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  errorText: { color: colors.danger, fontSize: 13, flex: 1 },
});
