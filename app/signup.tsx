import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Redirect } from "expo-router";
import { Button, TextField } from "@/components/ui";
import { colors, spacing, radius } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { homeFor } from "@/navigation";

// Admin self-registration. Creates an administrator account (email + password,
// with an optional phone) and signs straight in. Cashiers do not self-register
// — an admin creates them from the Users screen.
export default function SignUp() {
    const router = useRouter();
    const { role, register } = useAuth();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    if (role) return <Redirect href={homeFor(role) as any} />;

    const createAccount = async () => {
        setError(null);
        setBusy(true);
        const res = await register({ name, email, phone, password });
        setBusy(false);
        if (!res.ok) return setError(res.error);
        // Go home; the app's trial/licence gate routes new, unlicensed accounts
        // to the free-trial offer (see app/(app)/_layout.tsx).
        router.replace(homeFor(res.user.role) as any);
    };

    return (
        <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
            <KeyboardAvoidingView
                style={s.flex}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    contentContainerStyle={s.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={s.card}>
                        <Pressable
                            style={s.back}
                            onPress={() => router.replace("/")}
                        >
                            <Ionicons
                                name="chevron-back"
                                size={20}
                                color={colors.textMuted}
                            />
                            <Text style={s.backText}>Back to sign in</Text>
                        </Pressable>

                        <View style={s.brand}>
                            <View style={s.logo}>
                                <Ionicons
                                    name="person-add-outline"
                                    size={24}
                                    color={colors.accent}
                                />
                            </View>
                            <Text style={s.brandText}>
                                Create admin account
                            </Text>
                            <Text style={s.brandSub}>
                                Register as an administrator
                            </Text>
                        </View>

                        <View style={s.form}>
                            <TextField
                                label="Full Name"
                                icon="person-outline"
                                placeholder="Jane Doe"
                                value={name}
                                onChangeText={(v) => {
                                    setName(v);
                                    setError(null);
                                }}
                            />
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
                                label="Password"
                                icon="lock-closed-outline"
                                placeholder="At least 6 characters"
                                secureTextEntry
                                value={password}
                                onChangeText={(v) => {
                                    setPassword(v);
                                    setError(null);
                                }}
                            />

                            {error ? (
                                <View style={s.errorBox}>
                                    <Ionicons
                                        name="alert-circle"
                                        size={16}
                                        color={colors.danger}
                                    />
                                    <Text style={s.errorText}>{error}</Text>
                                </View>
                            ) : null}

                            <Button
                                title={busy ? "Creating…" : "Create Account"}
                                icon="checkmark-circle-outline"
                                onPress={createAccount}
                                disabled={busy}
                            />
                            <View style={s.footerRow}>
                                <Text style={s.footerText}>
                                    Already have an account?
                                </Text>
                                <Pressable onPress={() => router.replace("/")}>
                                    <Text style={s.link}>Sign in</Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.sidebar },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
    card: {
        width: "100%",
        maxWidth: 420,
        alignSelf: "center",
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.lg,
    },
    back: {
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        alignSelf: "flex-start",
    },
    backText: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
    brand: { alignItems: "center", gap: 6 },
    logo: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: colors.sidebar,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 4,
    },
    brandText: { fontSize: 22, fontWeight: "800", color: colors.text },
    brandSub: { fontSize: 14, color: colors.textMuted },
    form: { gap: spacing.md },
    footerRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 6,
        marginTop: 2,
    },
    footerText: { color: colors.textMuted, fontSize: 14 },
    link: { color: colors.primary, fontSize: 14, fontWeight: "700" },
    errorBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#fdecec",
        borderRadius: radius.sm,
        padding: spacing.sm,
    },
    errorText: { color: colors.danger, fontSize: 13, flex: 1 },
});
