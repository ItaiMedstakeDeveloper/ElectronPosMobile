import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Button, TextField } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useData } from '@/context/DataContext';

export default function Tax() {
  const { tax, setTax } = useData();
  const [value, setValue] = useState(String(tax));
  const [saved, setSaved] = useState(false);

  const save = () => {
    const n = parseFloat(value);
    if (!isNaN(n)) {
      setTax(n);
      setSaved(true);
    }
  };

  return (
    <Screen title="Setup Tax" subtitle="System-wide tax rate">
      <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg }}>
        <View style={s.badge}>
          <Ionicons name="calculator-outline" size={28} color={colors.primary} />
        </View>
        <Text style={s.current}>Current rate: {tax}%</Text>
      </Card>
      <Card>
        <View style={s.form}>
          <TextField
            label="Tax Value (%)"
            value={value}
            onChangeText={(v) => {
              setValue(v);
              setSaved(false);
            }}
            keyboardType="decimal-pad"
            placeholder="15"
          />
          <Button title="Save Tax Rate" icon="save-outline" onPress={save} />
          {saved ? <Text style={s.saved}>✓ Saved</Text> : null}
        </View>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  badge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  current: { fontSize: 18, fontWeight: '700', color: colors.text },
  form: { gap: spacing.md },
  saved: { color: colors.success, fontWeight: '600', textAlign: 'center' },
});
