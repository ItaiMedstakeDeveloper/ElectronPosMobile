import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, Card, Button, TextField } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useData } from '@/context/DataContext';
import type { Company as CompanyType } from '@/data/mockData';

export default function Company() {
  const { company, setCompany } = useData();
  const [form, setForm] = useState<CompanyType>(company);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof CompanyType>(k: K, v: CompanyType[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };
  const save = () => {
    setCompany(form);
    setSaved(true);
  };

  return (
    <Screen title="Set Up Company" subtitle="Company profile used on receipts and invoices">
      <Card>
        <View style={s.form}>
          <TextField label="Company Name" value={form.name} onChangeText={(v) => set('name', v)} />
          <TextField label="TIN Number" value={form.tin} onChangeText={(v) => set('tin', v)} keyboardType="number-pad" />
          <TextField label="VAT Number" value={form.vat} onChangeText={(v) => set('vat', v)} keyboardType="number-pad" />
          <TextField label="Address" value={form.address} onChangeText={(v) => set('address', v)} />
          <TextField label="Phone Number" value={form.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" />
          <TextField label="Email" value={form.email} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" />
          <TextField label="Bank Account Number" value={form.bankAccount} onChangeText={(v) => set('bankAccount', v)} />
          <TextField label="Bank Details" value={form.bankDetails} onChangeText={(v) => set('bankDetails', v)} />
          <Button title="Save Company Details" icon="save-outline" onPress={save} />
          {saved ? <Text style={s.saved}>✓ Saved</Text> : null}
        </View>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  form: { gap: spacing.md },
  saved: { color: colors.success, fontWeight: '600', textAlign: 'center' },
});
