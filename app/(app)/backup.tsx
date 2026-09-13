import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Screen, Card, Button } from "@/components/ui";
import { colors, spacing, radius } from "@/theme";
import { exportBackup, restoreBackup } from "@/lib/backup";
import { notify, confirmAction } from "@/lib/confirm";
import { useShop } from "@/context/ShopContext";

export default function Backup() {
  const { reloadAfterRestore } = useShop();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  const onExport = async () => {
    setBusy(true);
    const res = await exportBackup();
    setBusy(false);
    if (res.ok) {
      setLast(res.fileName);
      notify(
        `Backup ready (${res.shops} shop${res.shops === 1 ? "" : "s"}). Pick Google Drive — or WhatsApp, email, a USB drive — to save "${res.fileName}".`,
      );
    } else {
      notify(res.error);
    }
  };

  const onRestore = async () => {
    // Choose the backup file first, then confirm the destructive replace.
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/json", "*/*"],
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    const asset = picked.assets?.[0];
    if (!asset?.uri) return;

    confirmAction(
      `Restore from "${asset.name}"? This REPLACES all data on this device with the backup. This can't be undone.`,
      async () => {
        setBusy(true);
        const res = await restoreBackup(asset.uri);
        if (res.ok) {
          await reloadAfterRestore();
          setBusy(false);
          notify(
            `Restore complete — ${res.shops} shop${res.shops === 1 ? "" : "s"} restored.`,
          );
        } else {
          setBusy(false);
          notify(res.error);
        }
      },
    );
  };

  return (
    <Screen title="Backup" subtitle="Save a copy of all your shop data">
      <Card>
        <View style={s.head}>
          <View style={s.icon}>
            <Ionicons
              name="cloud-upload-outline"
              size={22}
              color={colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Export backup</Text>
            <Text style={s.sub}>
              Bundles every shop's products, sales, stock, customers and staff —
              plus your settings — into one file, then opens the share menu so
              you can save it to Google Drive or anywhere else.
            </Text>
          </View>
        </View>

        <Button
          title={busy ? "Preparing backup…" : "Export backup"}
          icon="share-outline"
          onPress={onExport}
          disabled={busy}
          style={{ marginTop: spacing.md }}
        />

        {last ? (
          <View style={s.note}>
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={colors.success}
            />
            <Text style={s.noteText}>Last export: {last}</Text>
          </View>
        ) : null}
      </Card>

      <Card>
        <View style={s.head}>
          <View style={s.icon}>
            <Ionicons name="cloud-download-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Restore backup</Text>
            <Text style={s.sub}>
              Pick a backup file to bring your shops, sales and settings back. This
              replaces everything currently on this device, so use it on a new or reset
              device.
            </Text>
          </View>
        </View>

        <Button
          title={busy ? "Working…" : "Restore backup"}
          icon="folder-open-outline"
          variant="outline"
          onPress={onRestore}
          disabled={busy}
          style={{ marginTop: spacing.md }}
        />
        <View style={s.warn}>
          <Ionicons name="warning-outline" size={15} color={colors.danger} />
          <Text style={s.warnText}>
            Restoring overwrites current data — export a fresh backup first if unsure.
          </Text>
        </View>
      </Card>

      <Card>
        <Text style={s.tipTitle}>Tips</Text>
        <Tip text="Back up regularly — after busy days or before updating the app." />
        <Tip text="Saving to Google Drive keeps a copy safe even if this device is lost." />
        <Tip text="Keep the backup file — you'll need it to restore your data." />
      </Card>
    </Screen>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <View style={s.tipRow}>
      <Ionicons
        name="ellipse"
        size={6}
        color={colors.textMuted}
        style={{ marginTop: 7 }}
      />
      <Text style={s.tipText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 19 },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
  },
  noteText: { fontSize: 13, color: colors.textMuted },
  warn: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: spacing.sm,
  },
  warnText: { flex: 1, fontSize: 12, color: colors.danger, lineHeight: 17 },
  tipTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  tipRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    marginBottom: 6,
  },
  tipText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 19 },
});
