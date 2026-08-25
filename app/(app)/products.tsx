import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Badge, Button, FormModal, TextField, Select } from '@/components/ui';
import { colors, spacing, radius, currency } from '@/theme';
import { useData } from '@/context/DataContext';
import { useCart } from '@/context/CartContext';
import { confirmAction, notify } from '@/lib/confirm';
import type { Product } from '@/data/mockData';

type Form = {
  name: string;
  sku: string;
  description: string;
  categoryId: string;
  cost: string;
  price: string;
  unit: Product['unit'];
  stock: string; // opening stock, only set at creation
};

const emptyForm = (categoryId: string): Form => ({
  name: '',
  sku: '',
  description: '',
  categoryId,
  cost: '',
  price: '',
  unit: 'Each',
  stock: '0',
});

// All products are zero-rated for tax.
const TAX_GROUP = '0%';

type StockAction = 'add' | 'writeoff';

export default function Products() {
  const { products, categories, availableStock, addStock, writeOffStock, currencyCode, exchangeRate } = useData();
  const { add: addToCart } = useCart();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const cols = width >= 1100 ? 3 : width >= 700 ? 2 : 1;

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm(categories.items[0]?.id ?? ''));

  // Inline "add category" inside the product form.
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [pendingCat, setPendingCat] = useState<string | null>(null);


  // Add Stock / Write Off bottom drawer.
  const [stockAction, setStockAction] = useState<StockAction | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockQty, setStockQty] = useState('');
  const [stockNote, setStockNote] = useState('');
  const [stockBusy, setStockBusy] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const catName = (id: string) => categories.items.find((c) => c.id === id)?.name ?? 'Uncategorised';

  // Prices are entered in USD. When ZiG is the active currency, show the live
  // ZiG equivalent of what's typed above the input so the cashier sees both.
  const zigPreview = (usd: string) => {
    const z = (Number(usd) || 0) * exchangeRate;
    return `≈ ZiG ${z.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Create a category on the fly from the product form. Because Collection.add
  // is fire-and-forget (it reloads asynchronously), we remember the name we just
  // added and auto-select it once it shows up in the list.
  const submitNewCat = () => {
    const name = newCat.trim();
    if (!name) return notify('Enter a category name.');
    if (categories.items.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      const existing = categories.items.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (existing) set('categoryId', existing.id);
      setAddingCat(false);
      setNewCat('');
      return;
    }
    categories.add({ name, createdAt: new Date().toISOString().slice(0, 10) });
    setPendingCat(name);
    setNewCat('');
    setAddingCat(false);
  };

  useEffect(() => {
    if (!pendingCat) return;
    const match = categories.items.find(
      (c) => c.name.toLowerCase() === pendingCat.toLowerCase()
    );
    if (match) {
      set('categoryId', match.id);
      setPendingCat(null);
    }
  }, [categories.items, pendingCat]);

  const openStock = (product: Product, action: StockAction) => {
    setStockProduct(product);
    setStockAction(action);
    setStockQty('');
    setStockNote('');
  };
  const closeStock = () => {
    setStockAction(null);
    setStockProduct(null);
  };
  const submitStock = async () => {
    if (!stockProduct || stockBusy) return;
    const qty = parseInt(stockQty, 10);
    if (Number.isNaN(qty) || qty <= 0) return notify('Enter a quantity greater than zero.');
    if (stockAction === 'writeoff' && qty > availableStock(stockProduct)) {
      return notify(`You can't write off more than the ${availableStock(stockProduct)} in stock.`);
    }
    setStockBusy(true);
    try {
      if (stockAction === 'add') await addStock(stockProduct, qty, stockNote.trim() || undefined);
      else await writeOffStock(stockProduct, qty, stockNote.trim() || undefined);
      closeStock();
    } finally {
      setStockBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.items.filter((p) => {
      const matchesQ = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchesC = !cat || p.categoryId === cat;
      return matchesQ && matchesC;
    });
  }, [query, cat, products.items]);

  const resetCatUi = () => {
    setAddingCat(false);
    setNewCat('');
    setPendingCat(null);
  };
  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm(categories.items[0]?.id ?? ''));
    resetCatUi();
    setModal(true);
  };
  const openEdit = (p: Product) => {
    setEditId(p.id);
    resetCatUi();
    setForm({
      name: p.name,
      sku: p.sku,
      description: p.description,
      categoryId: p.categoryId,
      cost: String(p.cost),
      price: String(p.price),
      unit: p.unit,
      stock: String(p.stock),
    });
    setModal(true);
  };
  const save = () => {
    // Validation mirrors the web app's product rules: name + barcode required,
    // barcode unique, and cost / selling price must be valid non-negative numbers.
    const name = form.name.trim();
    const sku = form.sku.trim();
    if (!name) return notify('Please enter a product name.');
    if (!form.categoryId || !categories.items.some((c) => c.id === form.categoryId)) {
      return notify(
        categories.items.length === 0
          ? 'Please create a category first, then add the product to it.'
          : 'Please select a category for this product.'
      );
    }
    if (!sku) return notify('Please enter a barcode / SKU.');
    const skuTaken = products.items.some(
      (p) => p.id !== editId && p.sku.trim().toLowerCase() === sku.toLowerCase()
    );
    if (skuTaken) return notify(`The barcode "${sku}" is already used by another product.`);

    const cost = Number(form.cost);
    if (form.cost.trim() === '' || Number.isNaN(cost) || cost < 0) {
      return notify('Cost price must be a valid number of 0 or more.');
    }
    const price = Number(form.price);
    if (form.price.trim() === '' || Number.isNaN(price) || price < 0) {
      return notify('Selling price must be a valid number of 0 or more.');
    }

    const base = {
      name,
      sku,
      description: form.description.trim() || name,
      categoryId: form.categoryId,
      cost,
      price,
      unit: form.unit,
    };
    if (editId) {
      // Opening stock is set once at creation; ongoing stock changes come from
      // GRVs (in) and sales (out), so it's left untouched on edit. Tax stays 0%.
      products.update(editId, base);
    } else {
      // Stock quantity here is the opening balance; GRVs add to it afterwards.
      const opening = parseInt(form.stock, 10);
      products.add({
        ...base,
        taxGroup: TAX_GROUP,
        stock: Number.isNaN(opening) || opening < 0 ? 0 : opening,
        reorderLevel: 0,
      });
    }
    setModal(false);
  };

  return (
    <Screen
      title="Products"
      subtitle={`${filtered.length} of ${products.items.length} items`}
      action={<Button title="Add" icon="add" onPress={openAdd} />}
    >
      <View style={s.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={s.search}
          placeholder="Search by name or SKU…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={s.chips}>
        <Chip label="All" active={cat === null} onPress={() => setCat(null)} />
        {categories.items.map((c) => (
          <Chip key={c.id} label={c.name} active={cat === c.id} onPress={() => setCat(c.id)} />
        ))}
      </View>

      <View style={[s.grid, { gap: spacing.md }]}>
        {filtered.map((p) => {
          const qty = availableStock(p);
          const low = qty <= p.reorderLevel;
          return (
            <Card key={p.id} style={{ flexBasis: `${100 / cols}%`, flexGrow: 1, minWidth: 220 }}>
              <View style={s.prodHead}>
                {/* Tap the product to add it to the cart for a sale. */}
                <Pressable style={{ flex: 1 }} onPress={() => addToCart(p)}>
                  <Text style={s.prodName}>{p.name}</Text>
                  <Text style={s.prodSku}>
                    {p.sku} · {catName(p.categoryId)}
                  </Text>
                </Pressable>
                <Pressable style={s.iconBtn} onPress={() => openEdit(p)}>
                  <Ionicons name="create-outline" size={18} color={colors.primary} />
                </Pressable>
                <Pressable
                  style={s.iconBtn}
                  onPress={() => confirmAction(`Delete "${p.name}"?`, () => products.remove(p.id))}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
              <View style={s.prodFooter}>
                <View style={s.priceBlock}>
                  <View style={s.priceRow}>
                    <Text style={s.priceTag}>Cost</Text>
                    <Text style={s.costValue}>{currency(p.cost)}</Text>
                  </View>
                  <View style={s.priceRow}>
                    <Text style={s.priceTag}>Sell</Text>
                    <Text style={s.price}>{currency(p.price)}</Text>
                  </View>
                </View>
                <Badge
                  text={low ? `${qty} left` : `${qty} in stock`}
                  tone={low ? 'danger' : 'muted'}
                />
              </View>
              <View style={s.stockActions}>
                <Pressable style={[s.stockBtn, s.addStockBtn]} onPress={() => openStock(p, 'add')}>
                  <Ionicons name="add-circle-outline" size={16} color="#fff" />
                  <Text style={s.addStockText}>Add Stock</Text>
                </Pressable>
                <Pressable style={[s.stockBtn, s.writeOffBtn]} onPress={() => openStock(p, 'writeoff')}>
                  <Ionicons name="remove-circle-outline" size={16} color={colors.danger} />
                  <Text style={s.writeOffText}>Write Off</Text>
                </Pressable>
              </View>
            </Card>
          );
        })}
        {filtered.length === 0 && <Text style={s.empty}>No products match your search.</Text>}
      </View>

      <FormModal
        visible={modal}
        title={editId ? 'Edit Product' : 'Add Product'}
        onClose={() => setModal(false)}
        onSubmit={save}
      >
        <TextField label="Product Name" value={form.name} onChangeText={(v) => set('name', v)} />

        <TextField
          label="Barcode / SKU"
          value={form.sku}
          onChangeText={(v) => set('sku', v)}
          placeholder="Enter barcode / SKU"
        />

        <TextField label="Description" value={form.description} onChangeText={(v) => set('description', v)} />

        <View>
          <Select
            label="Category"
            value={form.categoryId}
            onChange={(v) => set('categoryId', v)}
            options={categories.items.map((c) => ({ label: c.name, value: c.id }))}
          />
          {addingCat ? (
            <View style={s.newCatRow}>
              <TextField
                containerStyle={{ flex: 1 }}
                value={newCat}
                onChangeText={setNewCat}
                placeholder="New category name"
                autoFocus
                onSubmitEditing={submitNewCat}
              />
              <Pressable style={[s.catIconBtn, s.catAdd]} onPress={submitNewCat}>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </Pressable>
              <Pressable
                style={[s.catIconBtn, s.catCancel]}
                onPress={() => {
                  setAddingCat(false);
                  setNewCat('');
                }}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <Pressable style={s.addCatLink} onPress={() => setAddingCat(true)}>
              <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
              <Text style={s.addCatText}>Add new category</Text>
            </Pressable>
          )}
        </View>
        <View>
          {currencyCode === 'ZiG' ? <Text style={s.zigHint}>{zigPreview(form.cost)}</Text> : null}
          <TextField label="Cost Price (USD)" value={form.cost} onChangeText={(v) => set('cost', v)} keyboardType="decimal-pad" />
        </View>
        <View>
          {currencyCode === 'ZiG' ? <Text style={s.zigHint}>{zigPreview(form.price)}</Text> : null}
          <TextField label="Selling Price (USD)" value={form.price} onChangeText={(v) => set('price', v)} keyboardType="decimal-pad" />
        </View>
        <Select
          label="Unit of Measurement"
          value={form.unit}
          onChange={(v) => set('unit', v as Product['unit'])}
          options={[
            { label: 'Each', value: 'Each' },
            { label: 'Kg', value: 'Kg' },
            { label: 'L', value: 'L' },
            { label: 'M', value: 'M' },
          ]}
        />
        {!editId ? (
          <TextField
            label="Opening Stock Quantity"
            value={form.stock}
            onChangeText={(v) => set('stock', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="0"
          />
        ) : null}
      </FormModal>

      {/* Add Stock / Write Off bottom drawer */}
      <FormModal
        visible={stockAction !== null}
        title={stockAction === 'add' ? 'Add Stock' : 'Write Off Stock'}
        submitLabel={stockBusy ? 'Saving…' : stockAction === 'add' ? 'Update' : 'Write Off'}
        onClose={closeStock}
        onSubmit={submitStock}
      >
        {stockProduct ? (
          <>
            <View style={s.stockProdRow}>
              <Text style={s.stockProdName}>{stockProduct.name}</Text>
              <Text style={s.stockProdMeta}>{availableStock(stockProduct)} in stock</Text>
            </View>
            {stockAction === 'add' ? (
              <>
                <TextField
                  label="Stock Quantity Received (Each)"
                  value={stockQty}
                  onChangeText={(v) => setStockQty(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="0"
                />
                <TextField
                  label="Description of Stock Received"
                  value={stockNote}
                  onChangeText={setStockNote}
                  placeholder="e.g. Delivery from supplier"
                />
              </>
            ) : (
              <>
                <TextField
                  label="Quantity to Write Off"
                  value={stockQty}
                  onChangeText={(v) => setStockQty(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="0"
                />
                <TextField
                  label="Reason"
                  value={stockNote}
                  onChangeText={setStockNote}
                  placeholder="e.g. Damaged / expired"
                />
              </>
            )}
          </>
        ) : null}
      </FormModal>
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.chip, active && s.chipActive]} onPress={onPress}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  search: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text, outlineStyle: 'none' as any },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  prodHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginBottom: spacing.md },
  prodName: { fontSize: 16, fontWeight: '600', color: colors.text },
  prodSku: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  iconBtn: { padding: 4 },
  prodFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm },
  priceBlock: { gap: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  priceTag: { fontSize: 11, fontWeight: '700', color: colors.textMuted, width: 30, textTransform: 'uppercase' },
  costValue: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  price: { fontSize: 18, fontWeight: '700', color: colors.text },
  zigHint: { fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 4, textAlign: 'right' },
  addCatLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm, alignSelf: 'flex-start' },
  addCatText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  newCatRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  catIconBtn: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  catAdd: { backgroundColor: colors.success },
  catCancel: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  stockActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  stockBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  addStockBtn: { backgroundColor: colors.primary },
  addStockText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  writeOffBtn: { borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.surface },
  writeOffText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  stockProdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stockProdName: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
  stockProdMeta: { fontSize: 13, color: colors.textMuted },
  empty: { color: colors.textMuted, padding: spacing.md },
});
