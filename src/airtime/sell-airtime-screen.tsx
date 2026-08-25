import {
  addStock,
  DENOMINATIONS,
  getSales,
  getSession,
  getStock,
  InventoryNetwork,
  SaleRow,
  sellStock,
  StockRow,
  voidSale,
} from "./database";
import { DatePickerModal } from "./date-picker-modal";
import {
  addDays,
  endOfDay,
  formatDate,
  formatDateTime,
  money,
  startOfDay,
  ymd,
} from "./reports";
import { Mono, Palette, Radius } from "./theme";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const NETWORK_META: Record<
  InventoryNetwork,
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  econet: { label: "Econet", color: "#5B9BFF", icon: "cellular" },
  netone: { label: "NetOne", color: "#FF8A00", icon: "cellular" },
};

type SalesFilter = "today" | "yesterday" | "all" | "custom";

// The "all" view shows the most recent sales rather than the entire table, so
// the screen stays fast after months of daily use. Full history lives in
// Reports; older days remain reachable here via the date search.
const RECENT_LIMIT = 200;

export default function SellAirtimeScreen() {
  const [network, setNetwork] = useState<InventoryNetwork>("econet");
  const [stock, setStock] = useState<StockRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [todayRows, setTodayRows] = useState<SaleRow[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [salesFilter, setSalesFilter] = useState<SalesFilter>("all");

  // Custom date picker state
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const [pickerVisible, setPickerVisible] = useState(false);

  // Selected sale detail modal state
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);

  // Add-stock modal state
  const [addVisible, setAddVisible] = useState(false);
  const [addDenom, setAddDenom] = useState<number>(1);
  const [addQty, setAddQty] = useState("");
  const [addCost, setAddCost] = useState("");

  // Sell modal state
  const [sellTarget, setSellTarget] = useState<StockRow | null>(null);
  const [sellQty, setSellQty] = useState("1");
  const [sellPrice, setSellPrice] = useState("");

  const load = useCallback(async () => {
    try {
      const now = new Date();
      // The visible list is scoped at the SQL level: a single day for the
      // date filters, or the most recent RECENT_LIMIT rows for "all".
      let listQuery: Parameters<typeof getSales>[0];
      if (salesFilter === "today") {
        listQuery = {
          sinceIso: startOfDay(now).toISOString(),
          untilIso: endOfDay(now).toISOString(),
        };
      } else if (salesFilter === "yesterday") {
        const y = addDays(now, -1);
        listQuery = {
          sinceIso: startOfDay(y).toISOString(),
          untilIso: endOfDay(y).toISOString(),
        };
      } else if (salesFilter === "custom") {
        listQuery = {
          sinceIso: startOfDay(customDate).toISOString(),
          untilIso: endOfDay(customDate).toISOString(),
        };
      } else {
        listQuery = { limit: RECENT_LIMIT };
      }

      const [s, listRows, today, session] = await Promise.all([
        getStock(),
        getSales(listQuery),
        // Today's metrics must stay correct no matter which filter is active.
        getSales({
          sinceIso: startOfDay(now).toISOString(),
          untilIso: endOfDay(now).toISOString(),
        }),
        getSession(),
      ]);
      setStock(s);
      setSales(listRows);
      setTodayRows(today);
      setUserName(session?.name ?? null);
    } catch (err) {
      console.error("Failed to load inventory", err);
    }
  }, [salesFilter, customDate]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const meta = NETWORK_META[network];
  const networkStock = stock.filter((s) => s.network === network);
  const networkSales = sales.filter((s) => s.network === network);

  const totalCards = networkStock.reduce((sum, s) => sum + s.quantity, 0);
  const stockValue = networkStock.reduce(
    (sum, s) => sum + s.quantity * s.denomination,
    0,
  );
  const todayNetworkSales = todayRows.filter((s) => s.network === network);
  const todayRevenue = todayNetworkSales.reduce(
    (sum, s) => sum + s.quantity * s.unit_price,
    0,
  );
  const todayProfit = todayNetworkSales.reduce(
    (sum, s) => sum + s.quantity * (s.unit_price - s.unit_cost),
    0,
  );

  // A row per denomination (even those with zero stock) so the seller always
  // sees the full board and can restock any value.
  const board = DENOMINATIONS.map((denom) => {
    const row = networkStock.find((s) => s.denomination === denom);
    return {
      denomination: denom,
      quantity: row?.quantity ?? 0,
      unit_cost: row?.unit_cost ?? 0,
    };
  });

  // `sales` is already scoped to the selected date range (or recent window) by
  // the SQL query, so here we only group the current network's rows per day —
  // each day showing its own running total of cards and value sold.
  const salesDays = Array.from(
    networkSales
      .reduce((map, s) => {
        const key = ymd(new Date(s.created_at));
        const g = map.get(key) ?? { key, cards: 0, value: 0, items: [] };
        g.cards += s.quantity;
        g.value += s.quantity * s.unit_price;
        g.items.push(s);
        map.set(key, g);
        return map;
      }, new Map<string, { key: string; cards: number; value: number; items: SaleRow[] }>())
      .values(),
  ).sort((a, b) => (a.key < b.key ? 1 : -1));

  function openAdd() {
    setAddDenom(1);
    setAddQty("");
    setAddCost("");
    setAddVisible(true);
  }

  async function handleAdd() {
    const qty = parseInt(addQty, 10);
    if (!qty || qty <= 0) {
      Alert.alert("Invalid quantity", "Enter how many cards you're adding.");
      return;
    }
    const cost = addCost ? parseFloat(addCost) : 0;
    if (cost < 0 || Number.isNaN(cost)) {
      Alert.alert("Invalid cost", "Enter a valid buy price, or leave it blank.");
      return;
    }
    try {
      await addStock(network, addDenom, qty, cost, userName);
      setAddVisible(false);
      load();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not add stock.");
    }
  }

  function openSell(denomination: number, quantity: number, unit_cost: number) {
    if (quantity <= 0) {
      Alert.alert("Out of stock", `No ${money(denomination)} cards in stock.`);
      return;
    }
    setSellTarget({
      id: 0,
      network,
      denomination,
      quantity,
      unit_cost,
      updated_at: "",
    });
    setSellQty("1");
    setSellPrice(money(denomination).replace("$", ""));
  }

  async function handleSell() {
    if (!sellTarget) return;
    const qty = parseInt(sellQty, 10);
    if (!qty || qty <= 0) {
      Alert.alert("Invalid quantity", "Enter how many cards to sell.");
      return;
    }
    if (qty > sellTarget.quantity) {
      Alert.alert(
        "Not enough stock",
        `Only ${sellTarget.quantity} × ${money(sellTarget.denomination)} in stock.`,
      );
      return;
    }
    const price = sellPrice
      ? parseFloat(sellPrice)
      : sellTarget.denomination;
    if (!price || price <= 0) {
      Alert.alert("Invalid price", "Enter the price each card is sold at.");
      return;
    }
    try {
      await sellStock(
        sellTarget.network,
        sellTarget.denomination,
        qty,
        price,
        userName,
      );
      setSellTarget(null);
      load();
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err?.message ?? "Could not record the sale.");
    }
  }

  function handleVoid(sale: SaleRow) {
    const saleMeta = NETWORK_META[sale.network as InventoryNetwork];
    Alert.alert(
      "Void this sale?",
      `This removes the sale and returns ${sale.quantity} × ${money(
        sale.denomination,
      )} ${saleMeta.label} to stock.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Void Sale",
          style: "destructive",
          onPress: async () => {
            try {
              await voidSale(sale.id);
              setSelectedSale(null);
              load();
            } catch (err: any) {
              console.error(err);
              Alert.alert("Error", err?.message ?? "Could not void the sale.");
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Stock</Text>
            <Text style={styles.subtitle}>
              Add airtime cards to stock and sell them — the count drops with
              every sale.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.reportsBtn}
            activeOpacity={0.85}
            onPress={() => router.push("/reports" as any)}
          >
            <Ionicons name="bar-chart" size={16} color={Palette.background} />
            <Text style={styles.reportsBtnText}>Reports</Text>
          </TouchableOpacity>
        </View>

        {/* Network selector */}
        <View style={styles.segment}>
          {(Object.keys(NETWORK_META) as InventoryNetwork[]).map((n) => {
            const active = network === n;
            const m = NETWORK_META[n];
            return (
              <TouchableOpacity
                key={n}
                style={[
                  styles.segmentBtn,
                  active && { backgroundColor: m.color },
                ]}
                activeOpacity={0.85}
                onPress={() => setNetwork(n)}
              >
                <Ionicons
                  name={m.icon}
                  size={16}
                  color={active ? Palette.background : m.color}
                />
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? Palette.background : Palette.textMuted },
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Summary metrics */}
        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>In Stock</Text>
            <Text style={styles.metricValue}>{totalCards}</Text>
            <Text style={styles.metricSub}>cards</Text>
            <View style={[styles.metricAccent, { backgroundColor: meta.color }]} />
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Stock Value</Text>
            <Text style={styles.metricValue}>{money(stockValue)}</Text>
            <Text style={styles.metricSub}>at face value</Text>
            <View style={[styles.metricAccent, { backgroundColor: meta.color }]} />
          </View>
        </View>
        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{"Today's Sales"}</Text>
            <Text style={[styles.metricValue, { color: Palette.accent }]}>
              {money(todayRevenue)}
            </Text>
            <Text style={styles.metricSub}>{todayNetworkSales.length} sold</Text>
            <View style={[styles.metricAccent, { backgroundColor: Palette.accent }]} />
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{"Today's Profit"}</Text>
            <Text style={[styles.metricValue, { color: Palette.accent }]}>
              {money(todayProfit)}
            </Text>
            <Text style={styles.metricSub}>margin</Text>
            <View style={[styles.metricAccent, { backgroundColor: Palette.accent }]} />
          </View>
        </View>

        {/* Stock board */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>{meta.label} Stock</Text>
            <TouchableOpacity
              style={styles.addBtn}
              activeOpacity={0.85}
              onPress={openAdd}
            >
              <Ionicons name="add" size={16} color={Palette.background} />
              <Text style={styles.addBtnText}>Add Stock</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />

          {board.map((b, i) => {
            const out = b.quantity <= 0;
            const low = !out && b.quantity <= 3;
            return (
              <View key={b.denomination}>
                <View style={styles.stockRow}>
                  <View style={styles.stockLeft}>
                    <View
                      style={[
                        styles.denomChip,
                        { borderColor: meta.color },
                      ]}
                    >
                      <Text style={[styles.denomChipText, { color: meta.color }]}>
                        {money(b.denomination)}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.stockQty}>
                        {b.quantity} {b.quantity === 1 ? "card" : "cards"}
                      </Text>
                      <Text
                        style={[
                          styles.stockMeta,
                          low && { color: "#F59E0B" },
                          out && { color: Palette.textMuted },
                        ]}
                      >
                        {out
                          ? "Out of stock"
                          : low
                            ? "Low stock"
                            : `${money(b.quantity * b.denomination)} value`}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.sellBtn,
                      out && styles.sellBtnDisabled,
                    ]}
                    activeOpacity={0.85}
                    disabled={out}
                    onPress={() =>
                      openSell(b.denomination, b.quantity, b.unit_cost)
                    }
                  >
                    <Text
                      style={[
                        styles.sellBtnText,
                        out && { color: Palette.textMuted },
                      ]}
                    >
                      Sell
                    </Text>
                  </TouchableOpacity>
                </View>
                {i < board.length - 1 && <View style={styles.dividerLight} />}
              </View>
            );
          })}
        </View>

        {/* Sales with date filter + daily totals */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.rowCenter}>
              <Ionicons name="receipt-outline" size={18} color={Palette.accent} />
              <Text style={[styles.cardHeaderTitle, { marginLeft: 8 }]}>
                Sales
              </Text>
            </View>
          </View>

          {/* Search bar */}
          <TouchableOpacity
            style={styles.searchBar}
            activeOpacity={0.8}
            onPress={() => setPickerVisible(true)}
          >
            <View style={styles.searchBarLeft}>
              <Ionicons name="search" size={18} color={Palette.textMuted} />
              <Text
                style={[
                  styles.searchText,
                  salesFilter === "custom" && styles.searchTextActive,
                ]}
              >
                {salesFilter === "custom"
                  ? `Sales on ${formatDate(customDate)}`
                  : "Search sales by date..."}
              </Text>
            </View>
            {salesFilter === "custom" ? (
              <TouchableOpacity
                style={styles.searchClearBtn}
                activeOpacity={0.7}
                onPress={(e) => {
                  e.stopPropagation();
                  setSalesFilter("all");
                }}
              >
                <Ionicons name="close-circle" size={18} color={Palette.textMuted} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="calendar-outline" size={18} color={Palette.textMuted} />
            )}
          </TouchableOpacity>

          {salesDays.length > 0 ? (
            salesDays.map((day) => (
              <View key={day.key}>
                {/* Daily total header */}
                <View style={styles.dayHeader}>
                  <Text style={styles.dayHeaderDate}>
                    {formatDate(day.items[0].created_at)}
                  </Text>
                  <Text style={styles.dayHeaderTotals}>
                    {day.cards} {day.cards === 1 ? "card" : "cards"} ·{" "}
                    <Text style={styles.dayHeaderValue}>{money(day.value)}</Text>
                  </Text>
                </View>
                {day.items.map((s) => (
                  <View key={s.id} style={styles.saleRow}>
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", marginRight: 8 }}>
                      <View
                        style={[styles.saleDot, { backgroundColor: meta.color }]}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.saleTitle}>
                          {s.quantity} × {money(s.denomination)} {meta.label}
                        </Text>
                        <Text style={styles.saleDate} numberOfLines={1}>
                          {formatDateTime(s.created_at)}
                          {s.user_name ? ` · ${s.user_name}` : ""}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.saleRight}>
                      <Text style={styles.saleAmount}>
                        {money(s.quantity * s.unit_price)}
                      </Text>
                      <TouchableOpacity
                        style={styles.viewSaleBtn}
                        activeOpacity={0.7}
                        onPress={() => setSelectedSale(s)}
                      >
                        <Text style={styles.viewSaleBtnText}>View</Text>
                        <Ionicons name="chevron-forward" size={10} color={Palette.accent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))
          ) : (
            <View style={styles.empty}>
              <Ionicons
                name="cart-outline"
                size={36}
                color={Palette.textMuted}
              />
              <Text style={styles.emptyText}>
                {salesFilter === "all"
                  ? "No sales yet. Add stock, then tap Sell to record one."
                  : `No sales recorded ${salesFilter}.`}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add-stock modal */}
      <Modal
        visible={addVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add {meta.label} Stock</Text>
              <TouchableOpacity onPress={() => setAddVisible(false)}>
                <Ionicons name="close" size={24} color={Palette.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Denomination</Text>
            <View style={styles.denomGrid}>
              {DENOMINATIONS.map((d) => {
                const active = addDenom === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.denomOption,
                      active && { backgroundColor: meta.color, borderColor: meta.color },
                    ]}
                    activeOpacity={0.85}
                    onPress={() => setAddDenom(d)}
                  >
                    <Text
                      style={[
                        styles.denomOptionText,
                        { color: active ? Palette.background : Palette.text },
                      ]}
                    >
                      {money(d)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Quantity</Text>
            <TextInput
              style={styles.input}
              value={addQty}
              onChangeText={setAddQty}
              keyboardType="number-pad"
              placeholder="e.g. 20"
              placeholderTextColor={Palette.textMuted}
            />

            <Text style={styles.fieldLabel}>Buy price per card (optional)</Text>
            <TextInput
              style={styles.input}
              value={addCost}
              onChangeText={setAddCost}
              keyboardType="decimal-pad"
              placeholder={`e.g. ${money(addDenom * 0.9)}`}
              placeholderTextColor={Palette.textMuted}
            />
            <Text style={styles.hint}>
              {"Used to work out profit. Leave blank if you don't track cost."}
            </Text>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: meta.color }]}
              activeOpacity={0.85}
              onPress={handleAdd}
            >
              <Ionicons name="add-circle" size={20} color={Palette.background} />
              <Text style={styles.primaryBtnText}>Add to Stock</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sell modal */}
      <Modal
        visible={sellTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSellTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Sell {sellTarget ? money(sellTarget.denomination) : ""} {meta.label}
              </Text>
              <TouchableOpacity onPress={() => setSellTarget(null)}>
                <Ionicons name="close" size={24} color={Palette.textMuted} />
              </TouchableOpacity>
            </View>

            {sellTarget && (
              <Text style={styles.modalSub}>
                {sellTarget.quantity} in stock
              </Text>
            )}

            <Text style={styles.fieldLabel}>Quantity to sell</Text>
            <TextInput
              style={styles.input}
              value={sellQty}
              onChangeText={setSellQty}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={Palette.textMuted}
            />

            <Text style={styles.fieldLabel}>Price per card</Text>
            <TextInput
              style={styles.input}
              value={sellPrice}
              onChangeText={setSellPrice}
              keyboardType="decimal-pad"
              placeholder={sellTarget ? money(sellTarget.denomination) : ""}
              placeholderTextColor={Palette.textMuted}
            />

            {sellTarget && (
              <View style={styles.totalPreview}>
                <Text style={styles.totalPreviewLabel}>Total</Text>
                <Text style={styles.totalPreviewValue}>
                  {money(
                    (parseInt(sellQty, 10) || 0) *
                      (parseFloat(sellPrice) || 0),
                  )}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: Palette.accent }]}
              activeOpacity={0.85}
              onPress={handleSell}
            >
              <Ionicons name="cash" size={20} color={Palette.background} />
              <Text style={styles.primaryBtnText}>Record Sale</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <DatePickerModal
        visible={pickerVisible}
        value={customDate}
        onClose={() => setPickerVisible(false)}
        onSelect={(d) => {
          setCustomDate(d);
          setSalesFilter("custom");
          setPickerVisible(false);
        }}
      />

      {/* Sale Detail Modal (Full Card) */}
      <Modal
        visible={selectedSale !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSale(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sale Details</Text>
              <TouchableOpacity onPress={() => setSelectedSale(null)}>
                <Ionicons name="close" size={24} color={Palette.textMuted} />
              </TouchableOpacity>
            </View>

            {selectedSale && (() => {
              const saleNetwork = selectedSale.network as InventoryNetwork;
              const saleMeta = NETWORK_META[saleNetwork];
              const totalAmount = selectedSale.quantity * selectedSale.unit_price;
              const totalCost = selectedSale.quantity * selectedSale.unit_cost;
              const totalProfit = totalAmount - totalCost;

              return (
                <View style={styles.detailCard}>
                  {/* Network Icon/Header */}
                  <View style={styles.detailHeader}>
                    <View style={[styles.detailIconContainer, { backgroundColor: saleMeta.color }]}>
                      <Ionicons name={saleMeta.icon} size={24} color={Palette.background} />
                    </View>
                    <View>
                      <Text style={styles.detailNetworkLabel}>
                        {saleMeta.label} Airtime
                      </Text>
                      <Text style={styles.detailSaleId}>Sale ID: #{selectedSale.id}</Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  {/* Summary/Big Stats */}
                  <View style={styles.detailMainRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailMainLabel}>Total Revenue</Text>
                      <Text style={styles.detailMainValue}>{money(totalAmount)}</Text>
                    </View>
                    <View style={[styles.detailMainRight, { flex: 1 }]}>
                      <Text style={styles.detailMainLabel}>Profit / Margin</Text>
                      <Text style={[styles.detailMainValue, { color: Palette.accent }]}>
                        {money(totalProfit)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.dividerLight} />

                  {/* Grid details */}
                  <View style={styles.detailGrid}>
                    <View style={styles.detailGridRow}>
                      <View style={styles.detailGridCell}>
                        <Text style={styles.detailCellLabel}>Quantity</Text>
                        <Text style={styles.detailCellValue}>
                          {selectedSale.quantity} {selectedSale.quantity === 1 ? "card" : "cards"}
                        </Text>
                      </View>
                      <View style={styles.detailGridCell}>
                        <Text style={styles.detailCellLabel}>Denomination</Text>
                        <Text style={styles.detailCellValue}>
                          {money(selectedSale.denomination)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailGridRow}>
                      <View style={styles.detailGridCell}>
                        <Text style={styles.detailCellLabel}>Unit Price</Text>
                        <Text style={styles.detailCellValue}>
                          {money(selectedSale.unit_price)}
                        </Text>
                      </View>
                      <View style={styles.detailGridCell}>
                        <Text style={styles.detailCellLabel}>Unit Cost</Text>
                        <Text style={styles.detailCellValue}>
                          {money(selectedSale.unit_cost)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailGridRow}>
                      <View style={styles.detailGridCell}>
                        <Text style={styles.detailCellLabel}>Date & Time</Text>
                        <Text style={styles.detailCellValue}>
                          {formatDateTime(selectedSale.created_at)}
                        </Text>
                      </View>
                      <View style={styles.detailGridCell}>
                        <Text style={styles.detailCellLabel}>Sold By</Text>
                        <Text style={styles.detailCellValue}>
                          {selectedSale.user_name || "System"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.voidBtn, { marginTop: 24 }]}
                    activeOpacity={0.85}
                    onPress={() => handleVoid(selectedSale)}
                  >
                    <Ionicons
                      name="arrow-undo"
                      size={18}
                      color={Palette.danger}
                    />
                    <Text style={styles.voidBtnText}>
                      Void Sale · Return to Stock
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: Palette.border, marginTop: 10 }]}
                    activeOpacity={0.85}
                    onPress={() => setSelectedSale(null)}
                  >
                    <Text style={[styles.primaryBtnText, { color: Palette.text }]}>
                      Close Details
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  header: {
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: Palette.text,
  },
  subtitle: {
    fontSize: 14,
    color: Palette.textMuted,
    marginTop: 4,
    fontWeight: "500",
    lineHeight: 20,
  },
  reportsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Palette.accent,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.chip,
    marginTop: 4,
  },
  reportsBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: Palette.background,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Palette.input,
    borderRadius: Radius.button,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Palette.border,
    marginTop: 12,
    marginBottom: 4,
  },
  searchBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  searchText: {
    fontSize: 14,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  searchTextActive: {
    color: Palette.text,
    fontWeight: "800",
  },
  searchClearBtn: {
    padding: 4,
  },
  saleRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  viewSaleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: Palette.input,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.chip,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  viewSaleBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.accent,
  },
  detailCard: {
    width: "100%",
    gap: 12,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 4,
  },
  detailIconContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.icon,
    alignItems: "center",
    justifyContent: "center",
  },
  detailNetworkLabel: {
    fontSize: 18,
    fontWeight: "900",
    color: Palette.text,
  },
  detailSaleId: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
    fontWeight: "500",
  },
  detailMainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  detailMainLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailMainValue: {
    fontSize: 24,
    fontWeight: "900",
    color: Palette.text,
    fontFamily: Mono,
    marginTop: 4,
  },
  detailMainRight: {
    alignItems: "flex-end",
  },
  detailGrid: {
    gap: 12,
    marginTop: 8,
  },
  detailGridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  detailGridCell: {
    flex: 1,
    backgroundColor: Palette.input,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.card - 4,
    padding: 12,
  },
  detailCellLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  detailCellValue: {
    fontSize: 13,
    fontWeight: "800",
    color: Palette.text,
    marginTop: 4,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 6,
  },
  dayHeaderDate: {
    fontSize: 13,
    fontWeight: "800",
    color: Palette.text,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  dayHeaderTotals: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  dayHeaderValue: {
    color: Palette.accent,
    fontWeight: "800",
    fontFamily: Mono,
  },

  /* Network selector */
  segment: {
    flexDirection: "row",
    backgroundColor: Palette.input,
    borderRadius: Radius.button,
    padding: 4,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.chip,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "800",
  },

  /* Metrics */
  metricRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Palette.card,
    borderRadius: Radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: "hidden",
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "900",
    color: Palette.text,
    fontFamily: Mono,
    letterSpacing: -1,
    marginTop: 6,
  },
  metricSub: {
    fontSize: 12,
    fontWeight: "500",
    color: Palette.textMuted,
    marginTop: 2,
  },
  metricAccent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
  },

  /* Cards */
  card: {
    backgroundColor: Palette.card,
    borderRadius: Radius.card,
    padding: 18,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rowCenter: {
    flexDirection: "row",
    alignItems: "center",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.chip,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: Palette.background,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.border,
    marginVertical: 12,
  },
  dividerLight: {
    height: 1,
    backgroundColor: Palette.border,
    opacity: 0.5,
  },

  /* Stock rows */
  stockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  stockLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  denomChip: {
    minWidth: 52,
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.chip,
    borderWidth: 1.5,
    backgroundColor: Palette.input,
  },
  denomChipText: {
    fontSize: 14,
    fontWeight: "900",
    fontFamily: Mono,
  },
  stockQty: {
    fontSize: 15,
    fontWeight: "800",
    color: Palette.text,
  },
  stockMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
    marginTop: 2,
  },
  sellBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: Radius.chip,
    borderWidth: 1,
    borderColor: Palette.accent,
    backgroundColor: Palette.input,
  },
  sellBtnDisabled: {
    borderColor: Palette.border,
    backgroundColor: "transparent",
  },
  sellBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: Palette.accent,
  },

  /* Sales */
  saleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  saleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  saleTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.text,
  },
  saleDate: {
    fontSize: 12,
    fontWeight: "500",
    color: Palette.textMuted,
    marginTop: 2,
  },
  saleAmount: {
    fontSize: 16,
    fontWeight: "900",
    color: Palette.accent,
    fontFamily: Mono,
  },
  empty: {
    paddingVertical: 28,
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    color: Palette.textMuted,
    fontStyle: "italic",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 20,
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: Palette.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: 6,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: Palette.text,
  },
  modalSub: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.textMuted,
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.textMuted,
    marginTop: 12,
    marginBottom: 6,
  },
  denomGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  denomOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.chip,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.input,
  },
  denomOptionText: {
    fontSize: 14,
    fontWeight: "800",
    fontFamily: Mono,
  },
  input: {
    backgroundColor: Palette.input,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Palette.text,
    fontWeight: "700",
  },
  hint: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 6,
    fontWeight: "500",
  },
  totalPreview: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Palette.input,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
  },
  totalPreviewLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  totalPreviewValue: {
    fontSize: 20,
    fontWeight: "900",
    color: Palette.accent,
    fontFamily: Mono,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: Radius.button,
    marginTop: 20,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "900",
    color: Palette.background,
  },
  voidBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Palette.danger,
    backgroundColor: "transparent",
  },
  voidBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: Palette.danger,
  },
});
