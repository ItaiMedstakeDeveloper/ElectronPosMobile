import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius } from "@/theme";
import { useLicense } from "@/context/LicenseContext";

// Small pill shown in the sidebar / drawer while a free trial is running. Reads
// the live countdown from the licence context; renders nothing when no trial is
// active (e.g. a paid licence, or the trial hasn't been started).
export function TrialBadge() {
  const { status, trialActive, trialDaysLeft } = useLicense();

  // A paid licence supersedes the trial; don't show the trial pill then.
  if (status === "active" || !trialActive || trialDaysLeft == null) return null;

  return (
    <View style={s.pill}>
      <Ionicons name="time-outline" size={16} color={colors.accent} />
      <Text style={s.text}>
        Trial · {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: "rgba(247,181,0,0.14)",
  },
  text: { color: colors.accent, fontSize: 13, fontWeight: "700" },
});
