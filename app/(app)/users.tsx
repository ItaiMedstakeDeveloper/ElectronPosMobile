import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Badge, Button, FormModal, TextField, Select } from '@/components/ui';
import { colors, spacing } from '@/theme';
import * as db from '@/db/db';
import { useAuth } from '@/context/AuthContext';
import { confirmAction, notify } from '@/lib/confirm';
import type { AppUser, UserRole } from '@/data/mockData';

type Form = {
  name: string;
  role: UserRole;
  email: string;
  phone: string;
  // Password for admin/manager, passcode for cashier. Blank on edit = unchanged.
  secret: string;
  active: boolean;
};
const empty: Form = { name: '', role: 'cashier', email: '', phone: '', secret: '', active: true };

const roleLabel: Record<UserRole, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  cashier: 'Cashier',
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty);

  const isCashier = form.role === 'cashier';

  // This screen manages the ACTIVE shop's own staff (managers + cashiers).
  // Administrators are global "owners" that span all shops, so they aren't
  // listed or created here.
  const staff = users.filter((u) => u.role !== 'admin');

  const reload = () => db.getUsers().then(setUsers).catch(console.error);
  useEffect(() => {
    reload();
  }, []);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => {
    setEditId(null);
    setForm(empty);
    setModal(true);
  };

  const openEdit = (u: AppUser) => {
    setEditId(u.id);
    setForm({
      name: u.name,
      role: u.role,
      email: u.email ?? '',
      phone: u.phone ?? '',
      secret: '',
      active: u.active,
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return notify('Please enter a name.');

    if (isCashier) {
      if (!form.phone.trim()) return notify('Please enter a phone number.');
      if (!editId && !form.secret.trim()) return notify('Please set a passcode for the cashier.');
      if (form.secret && !/^\d{1,6}$/.test(form.secret)) {
        return notify('The passcode must be numeric and at most 6 digits.');
      }
    } else {
      if (!form.email.trim()) return notify('Please enter an email.');
      if (!editId && !form.secret.trim()) return notify('Please set a password for the new user.');
    }

    // Cashiers have no email; managers have no phone-based login.
    const email = isCashier ? null : form.email.trim();
    const phone = isCashier ? form.phone.trim() : form.phone.trim() || null;

    try {
      if (editId) {
        await db.updateUser(editId, {
          name: form.name.trim(),
          email,
          phone,
          role: form.role,
          active: form.active,
          secret: form.secret,
        });
      } else {
        await db.createUser({
          name: form.name.trim(),
          email,
          phone,
          secret: form.secret,
          role: form.role,
          active: form.active,
        });
      }
      setModal(false);
      reload();
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (/unique/i.test(msg)) notify('That email or phone number is already in use.');
      else notify('Could not save the user. Please try again.');
    }
  };

  const remove = async (u: AppUser) => {
    if (u.id === currentUser?.id) return notify('You cannot delete the account you are signed in with.');
    confirmAction(`Delete "${u.name}"?`, () => db.deleteUser(u.id).then(reload).catch(console.error));
  };

  return (
    <Screen
      title="Users"
      subtitle={`${staff.length} staff account${staff.length === 1 ? '' : 's'} in this shop`}
      action={<Button title="Add" icon="add" onPress={openAdd} />}
    >
      {staff.map((u) => (
        <Card key={u.id}>
          <View style={s.row}>
            <View style={[s.avatar, u.role === 'admin' && s.avatarAdmin]}>
              <Ionicons
                name={u.role === 'admin' ? 'shield-checkmark' : u.role === 'manager' ? 'briefcase' : 'person'}
                size={20}
                color="#fff"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{u.name}</Text>
              <Text style={s.meta}>{u.role === 'cashier' ? u.phone : u.email}</Text>
            </View>
            <View style={s.actions}>
              <Badge text={roleLabel[u.role]} tone={u.role === 'admin' ? 'accent' : 'muted'} />
              {!u.active ? <Badge text="Inactive" tone="danger" /> : null}
              <View style={s.iconRow}>
                <Pressable style={s.iconBtn} onPress={() => openEdit(u)}>
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </Pressable>
                <Pressable style={s.iconBtn} onPress={() => remove(u)}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          </View>
        </Card>
      ))}

      <FormModal
        visible={modal}
        title={editId ? 'Edit User' : 'Create User'}
        onClose={() => setModal(false)}
        onSubmit={save}
      >
        <TextField label="Name" value={form.name} onChangeText={(v) => set('name', v)} />
        <Select
          label="Role"
          value={form.role}
          onChange={(v) => set('role', v as UserRole)}
          options={[
            { label: 'Manager', value: 'manager' },
            { label: 'Cashier', value: 'cashier' },
          ]}
        />

        {isCashier ? (
          <>
            <TextField
              label="Phone Number"
              value={form.phone}
              onChangeText={(v) => set('phone', v)}
              keyboardType="phone-pad"
              placeholder="+263 77 123 4567"
            />
            <TextField
              label={editId ? 'New Passcode (leave blank to keep)' : 'Passcode'}
              value={form.secret}
              onChangeText={(v) => set('secret', v.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              placeholder="Up to 6 digits"
            />
          </>
        ) : (
          <>
            <TextField
              label="Email"
              value={form.email}
              onChangeText={(v) => set('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextField
              label="Phone Number (optional)"
              value={form.phone}
              onChangeText={(v) => set('phone', v)}
              keyboardType="phone-pad"
              placeholder="+263 77 123 4567"
            />
            <TextField
              label={editId ? 'New Password (leave blank to keep)' : 'Password'}
              value={form.secret}
              onChangeText={(v) => set('secret', v)}
              secureTextEntry
              placeholder="••••••••"
            />
          </>
        )}

        <Select
          label="Status"
          value={form.active ? 'active' : 'inactive'}
          onChange={(v) => set('active', v === 'active')}
          options={[
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
          ]}
        />
      </FormModal>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAdmin: { backgroundColor: colors.primary },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  actions: { alignItems: 'flex-end', gap: 4 },
  iconRow: { flexDirection: 'row' },
  iconBtn: { padding: 6 },
});
