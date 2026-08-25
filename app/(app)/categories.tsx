import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Button, FormModal, TextField } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useData } from '@/context/DataContext';
import { confirmAction, notify } from '@/lib/confirm';

export default function Categories() {
  const { categories, products } = useData();
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');

  const openAdd = () => {
    setEditId(null);
    setName('');
    setModal(true);
  };
  const openEdit = (id: string, current: string) => {
    setEditId(id);
    setName(current);
    setModal(true);
  };
  const save = () => {
    if (!name.trim()) return;
    if (editId) categories.update(editId, { name: name.trim() });
    else categories.add({ name: name.trim(), createdAt: new Date().toISOString().slice(0, 10) });
    setModal(false);
  };

  return (
    <Screen
      title="Categories"
      subtitle={`${categories.items.length} categories`}
      action={<Button title="Add" icon="add" onPress={openAdd} />}
    >
      <Card style={{ padding: 0 }}>
        {categories.items.map((c, idx) => (
          <View key={c.id} style={[s.row, idx < categories.items.length - 1 && s.divider]}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{c.name}</Text>
              <Text style={s.meta}>Created {c.createdAt}</Text>
            </View>
            <Pressable style={s.iconBtn} onPress={() => openEdit(c.id, c.name)}>
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </Pressable>
            <Pressable
              style={s.iconBtn}
              onPress={() => {
                const inUse = products.items.filter((p) => p.categoryId === c.id).length;
                if (inUse > 0) {
                  notify(
                    `Cannot delete "${c.name}": ${inUse} product${inUse === 1 ? '' : 's'} still use this category. Reassign or delete them first.`
                  );
                  return;
                }
                confirmAction(`Delete "${c.name}"?`, () => categories.remove(c.id));
              }}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
        ))}
        {categories.items.length === 0 ? <Text style={s.empty}>No categories yet.</Text> : null}
      </Card>

      <FormModal
        visible={modal}
        title={editId ? 'Edit Category' : 'Add Category'}
        onClose={() => setModal(false)}
        onSubmit={save}
      >
        <TextField label="Category Name" placeholder="e.g. Beverages" value={name} onChangeText={setName} />
      </FormModal>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  iconBtn: { padding: 6 },
  empty: { padding: spacing.md, color: colors.textMuted },
});
