import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Card, Button } from '@/components/ui';
import { spacing } from '@/theme';
import { useData } from '@/context/DataContext';
import { notify } from '@/lib/confirm';
import { CustomerFields, CustomerForm, emptyCustomer } from '@/components/CustomerFields';

export default function CreateCustomer() {
  const router = useRouter();
  const { customers } = useData();
  const [form, setForm] = useState<CustomerForm>(emptyCustomer);

  const set = <K extends keyof CustomerForm>(k: K, v: CustomerForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const create = () => {
    // Mirror the Laravel createCustomer rules: customer_name required, code
    // required and unique across customers.
    if (!form.name.trim()) {
      notify('Please enter a customer name.');
      return;
    }
    if (!form.code.trim()) {
      notify('Please enter a customer code.');
      return;
    }
    const code = form.code.trim().toLowerCase();
    if (customers.items.some((c) => c.code.trim().toLowerCase() === code)) {
      notify(`The code "${form.code.trim()}" is already used by another customer.`);
      return;
    }
    customers.add({ ...form, name: form.name.trim(), code: form.code.trim(), balance: 0 });
    router.replace('/customers');
  };

  return (
    <Screen title="Create Customer" subtitle="Register a new customer">
      <Card>
        <View style={s.form}>
          <CustomerFields form={form} set={set} />
          <Button title="Create Customer" icon="checkmark-circle-outline" onPress={create} />
        </View>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  form: { gap: spacing.md },
});
