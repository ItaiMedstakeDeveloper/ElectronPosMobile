import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Card, Button } from "@/components/ui";
import { colors, spacing, radius } from "@/theme";
import { useData } from "@/context/DataContext";
import {
  isBluetoothPrintingAvailable,
  ensureBluetoothReady,
  scanForPrinters,
  connectPrinter,
  printTest,
  openBluetoothSettings,
  type BtDevice,
} from "@/lib/printer";
import { notify } from "@/lib/confirm";
import type { Printer } from "@/data/mockData";

export default function Printers() {
  const { printer, setPrinter } = useData();
  const [devices, setDevices] = useState<BtDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connectingTo, setConnectingTo] = useState<string | null>(null);

  const available = isBluetoothPrintingAvailable();
  const connected = printer.status === "connected" && !!printer.deviceId;

  const scan = async () => {
    if (!(await ensureBluetoothReady())) return;
    setScanning(true);
    try {
      const { paired, found } = await scanForPrinters();
      // Merge, de-duplicate by address (paired first).
      const seen = new Set<string>();
      const merged: BtDevice[] = [];
      for (const d of [...paired, ...found]) {
        if (seen.has(d.address)) continue;
        seen.add(d.address);
        merged.push(d);
      }
      setDevices(merged);
      if (merged.length === 0)
        notify(
          "No Bluetooth devices found. Make sure the printer is on and discoverable.",
        );
    } catch (e) {
      console.warn(e);
      notify("Scan failed. Check Bluetooth is on and permissions are granted.");
    } finally {
      setScanning(false);
    }
  };

  const connect = async (d: BtDevice) => {
    setConnectingTo(d.address);
    try {
      await connectPrinter(d.address);
      const next: Printer = {
        name: d.name,
        connectionMode: "Bluetooth",
        deviceId: d.address,
        status: "connected",
      };
      setPrinter(next);
      notify(`Connected to ${d.name}.`);
    } catch (e) {
      console.warn(e);
      notify(`Could not connect to ${d.name}.`);
    } finally {
      setConnectingTo(null);
    }
  };

  return (
    <Screen
      title="Printer Setup"
      subtitle="Connect your Bluetooth receipt printer"
    >
      {/* Status */}
      <Card>
        <View style={s.statusRow}>
          <View
            style={[
              s.dot,
              {
                backgroundColor: connected ? colors.success : colors.textMuted,
              },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.name}>
              {connected ? printer.name : "No printer connected"}
            </Text>
            <Text style={s.meta}>
              {connected
                ? `Bluetooth · ${printer.deviceId}`
                : "Scan and connect a printer below"}
            </Text>
          </View>
          <Ionicons
            name="bluetooth"
            size={24}
            color={connected ? colors.primary : colors.textMuted}
          />
        </View>
      </Card>

      {!available ? (
        <Card>
          <Text style={s.warnTitle}>Bluetooth printing unavailable here</Text>
          <Text style={s.warnText}>
            Scanning and connecting to a Bluetooth printer only works in the
            installed app (a dev build), not in Expo Go. Build and run the app
            on the device to use the printer.
          </Text>
        </Card>
      ) : null}

      {/* Scan + device list */}
      <Card>
        <View style={s.scanHead}>
          <Text style={s.sectionTitle}>Available printers</Text>
          <Pressable style={s.scanBtn} onPress={scan} disabled={scanning}>
            {scanning ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="search" size={16} color={colors.primary} />
            )}
            <Text style={s.scanText}>{scanning ? "Scanning…" : "Scan"}</Text>
          </Pressable>
        </View>

        {devices.length === 0 ? (
          <Text style={s.empty}>
            Tap Scan to find nearby Bluetooth printers.
          </Text>
        ) : (
          devices.map((d) => {
            const isConnected = connected && printer.deviceId === d.address;
            return (
              <Pressable
                key={d.address}
                style={[s.device, isConnected && s.deviceConnected]}
                onPress={() => connect(d)}
                disabled={connectingTo !== null}
              >
                <Ionicons
                  name={isConnected ? "checkmark-circle" : "print-outline"}
                  size={20}
                  color={isConnected ? colors.success : colors.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.deviceName}>{d.name}</Text>
                  <Text style={s.deviceAddr}>{d.address}</Text>
                </View>
                {connectingTo === d.address ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text
                    style={[
                      s.connectLabel,
                      isConnected && { color: colors.success },
                    ]}
                  >
                    {isConnected ? "Connected" : "Connect"}
                  </Text>
                )}
              </Pressable>
            );
          })
        )}
      </Card>

      {/* Actions */}
      <Card>
        <View style={s.form}>
          <Button
            title="Print Test Page"
            variant="outline"
            icon="document-text-outline"
            onPress={() => printTest(printer.deviceId)}
          />
          <Button
            title="Open Bluetooth Settings"
            variant="outline"
            icon="bluetooth-outline"
            onPress={openBluetoothSettings}
          />
          <Text style={s.hint}>
            Turn the printer on and make it discoverable, then Scan and tap it
            to connect. Receipts then print automatically at checkout.
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { fontSize: 16, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  warnTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.danger,
    marginBottom: 4,
  },
  warnText: { fontSize: 13, color: colors.textMuted },
  scanHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  scanText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  empty: { color: colors.textMuted, fontSize: 13, paddingVertical: spacing.sm },
  device: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deviceConnected: {},
  deviceName: { fontSize: 15, fontWeight: "600", color: colors.text },
  deviceAddr: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  connectLabel: { fontSize: 13, fontWeight: "700", color: colors.primary },
  form: { gap: spacing.md },
  hint: { fontSize: 12, color: colors.textMuted },
});
