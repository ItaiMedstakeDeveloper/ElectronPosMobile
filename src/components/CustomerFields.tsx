import React from 'react';
import { TextField, Select } from '@/components/ui';
import type { Customer } from '@/data/mockData';

export type CustomerForm = Omit<Customer, 'id' | 'balance'>;

export const emptyCustomer: CustomerForm = {
  name: '',
  code: '',
  phone: '',
  email: '',
  address: '',
  tin: '',
  vat: '',
  type: 'Cash',
  status: 'Active',
};

// Shared field set used by both the "View Customers" edit modal and the
// dedicated "Create Customer" screen.
export function CustomerFields({
  form,
  set,
}: {
  form: CustomerForm;
  set: <K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) => void;
}) {
  return (
    <>
      <TextField label="Customer Name" value={form.name} onChangeText={(v) => set('name', v)} />
      <TextField label="Customer Code" value={form.code} onChangeText={(v) => set('code', v)} />
      <TextField label="Phone Number" value={form.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" />
      <TextField label="Email" value={form.email} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" />
      <TextField label="Address" value={form.address} onChangeText={(v) => set('address', v)} />
      <TextField label="TIN Number" value={form.tin} onChangeText={(v) => set('tin', v)} keyboardType="number-pad" />
      <TextField label="VAT Number" value={form.vat} onChangeText={(v) => set('vat', v)} keyboardType="number-pad" />
      <Select
        label="Customer Type"
        value={form.type}
        onChange={(v) => set('type', v as CustomerForm['type'])}
        options={[
          { label: 'Cash', value: 'Cash' },
          { label: 'Credit', value: 'Credit' },
        ]}
      />
      <Select
        label="Status"
        value={form.status}
        onChange={(v) => set('status', v as CustomerForm['status'])}
        options={[
          { label: 'Active', value: 'Active' },
          { label: 'Not Active', value: 'Not Active' },
        ]}
      />
    </>
  );
}
