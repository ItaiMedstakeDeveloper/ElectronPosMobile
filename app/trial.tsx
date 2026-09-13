import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Redirect } from "expo-router";
import { Button } from "@/components/ui";
import { colors, spacing, radius } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { useLicense, TRIAL_DAYS } from "@/context/LicenseContext";
import { homeFor } from "@/navigation";

// Shown right after registration: offers the free familiarisation period. The
// button starts the trial (records the start time) and enters the app.
export default function TrialOffer() {
  const router = useRouter();
  const { role } = useAuth();
  const { status, trialStarted, startTrial } = useLicense();
  const [busy, setBusy] = useState(false);

  // Must be signed in to see the offer.
  if (!role) return <Redirect href="/" />;
  // If a licence is already active, or the trial was already started, skip
  // straight into the app — the offer is a one-time thing.
  if (status === "active" || trialStarted) {
    return <Redirect href={homeFor(role) as any} />;
  }

  const begin = async () => {
    setBusy(true);
    try {
      await startTrial();
      router.replace(homeFor(role) as any);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <View style={s.badge}>
            <Ionicons name="gift-outline" size={30} color={colors.accent} />
          </View>

          <Text style={s.heading}>Get Full Access To The Platform For Free</Text>

          <Text style={s.body}>
            You're eligible for a Free Familiarisation Period — full access to ring up sales,
            track stock, print receipts, manage your team, and see exactly how your shop is
            performing. Explore every feature and run your business with confidence.
          </Text>

          <View style={s.counter}>
            <Text style={s.counterLabel}>Offer Ends in</Text>
            <Text style={s.counterValue}>{TRIAL_DAYS} days</Text>
          </View>

          <Button
            title={busy ? "Starting…" : "Start Free Trial"}
            icon="rocket-outline"
            onPress={begin}
            disabled={busy}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sidebar },
  scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  card: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
    alignItems: "center",
  },
  badge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: colors.sidebar,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    lineHeight: 30,
  },
  body: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  counter: {
    width: "100%",
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  counterLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  counterValue: { fontSize: 30, fontWeight: "800", color: colors.primary },
});
