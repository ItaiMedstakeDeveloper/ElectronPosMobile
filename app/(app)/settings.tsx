import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card } from '@/components/ui';
import { colors, spacing } from '@/theme';

// Mirrors the "Accounts Settings" group from the original sidebar:
// company setup, tax, and printer configuration.
const groups = [
  {
    title: 'Company',
    items: [
      { icon: 'business-outline', label: 'Company Details', value: 'Electron POS Ltd' },
      { icon: 'location-outline', label: 'Address', value: 'Harare, Zimbabwe' },
      { icon: 'call-outline', label: 'Phone', value: '+263 24 000 0000' },
    ],
  },
  {
    title: 'Tax',
    items: [
      { icon: 'calculator-outline', label: 'VAT Rate', value: '15%' },
      { icon: 'card-outline', label: 'Currency', value: 'USD ($)' },
    ],
  },
  {
    title: 'Printers',
    items: [
      { icon: 'print-outline', label: 'Receipt Printer', value: 'Not configured' },
      { icon: 'document-outline', label: 'Receipt Size', value: '80mm' },
    ],
  },
] as const;

export default function Settings() {
  return (
    <Screen title="Settings" subtitle="Company, tax and printer configuration">
      {groups.map((g) => (
        <View key={g.title} style={{ gap: spacing.sm }}>
          <Text style={s.groupTitle}>{g.title}</Text>
          <Card style={{ padding: 0 }}>
            {g.items.map((it, idx) => (
              <View key={it.label} style={[s.row, idx < g.items.length - 1 && s.divider]}>
                <Ionicons name={it.icon as any} size={20} color={colors.textMuted} />
                <Text style={s.label}>{it.label}</Text>
                <Text style={s.value}>{it.value}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.border} />
              </View>
            ))}
          </Card>
        </View>
      ))}
      <Text style={s.note}>Settings are read-only in this mock build. They become editable once a backend is connected.</Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  groupTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { flex: 1, fontSize: 15, color: colors.text },
  value: { fontSize: 14, color: colors.textMuted },
  note: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' },
});
