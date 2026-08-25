import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import * as seed from "@/data/mockData";
import * as db from "@/db/db";
import { setCurrencyConfig, type CurrencyCode } from "@/theme";
import type {
    Category,
    Product,
    Customer,
    Supplier,
    Employee,
    PurchaseOrder,
    GRV,
    Quote,
    Company,
    Printer,
    LineItem,
} from "@/data/mockData";

// In-memory store for most entities. Categories and Products are persisted in a
// real SQLite database (see src/db/db.ts) with a foreign key from products to
// categories; if SQLite is unavailable (e.g. some web targets) we fall back to
// the seed data so the app keeps working.

let counter = 5000;
const uid = (prefix: string) => `${prefix}${++counter}`;

export type Collection<T extends { id: string }> = {
    items: T[];
    add: (item: Omit<T, "id">) => void;
    update: (id: string, patch: Partial<T>) => void;
    remove: (id: string) => void;
};

function useCollection<T extends { id: string }>(
    prefix: string,
    initial: T[],
): Collection<T> {
    const [items, setItems] = useState<T[]>(initial);
    return {
        items,
        add: (item) =>
            setItems((prev) => [{ ...item, id: uid(prefix) } as T, ...prev]),
        update: (id, patch) =>
            setItems((prev) =>
                prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
            ),
        remove: (id) => setItems((prev) => prev.filter((i) => i.id !== id)),
    };
}

type DataState = {
    categories: Collection<Category>;
    products: Collection<Product>;
    customers: Collection<Customer>;
    suppliers: Collection<Supplier>;
    employees: Collection<Employee>;
    purchaseOrders: Collection<PurchaseOrder>;
    grvs: Collection<GRV>;
    quotes: Collection<Quote>;
    // Stock received per product id, aggregated from the `stocks` ledger (GRVs).
    stockLevels: Record<string, db.StockLevel>;
    // Available quantity for a product: opening stock + received via GRVs
    // - sold via sales.
    availableStock: (product: Product) => number;
    // Total cost value of everything received into stock (SUM of stocks.total_cost).
    totalStockValue: number;
    // Persist a completed sale (from checkout) and refresh stock. Returns the
    // new sale id.
    recordSale: (sale: db.SaleInput) => Promise<number>;
    // Sales history for the Sales screen. `listSales` optionally filters by an
    // inclusive yyyy-mm-dd range; `reverseSale` voids a transaction (restoring
    // stock) and returns the refreshed list.
    listSales: (from?: string, to?: string) => Promise<db.SaleRecord[]>;
    reverseSale: (saleId: number) => Promise<void>;
    // Receive a purchase order: create a linked GRV (raising stock) and mark the
    // PO as received.
    receivePurchaseOrder: (input: {
        po: PurchaseOrder;
        items: LineItem[];
        date: string;
        supplierInvoiceNumber?: string;
    }) => Promise<void>;
    // Manual stock moves from the product list: add received stock / write off.
    addStock: (product: Product, quantity: number, note?: string) => Promise<void>;
    writeOffStock: (product: Product, quantity: number, note?: string) => Promise<void>;
    // Display currency. Prices are stored in USD; the app can show USD or ZiG at
    // a set exchange rate (ZiG per 1 USD).
    currencyCode: CurrencyCode;
    exchangeRate: number;
    // Switch display currency. `rate` is only meaningful for ZiG; omit it (e.g.
    // when switching to USD) to keep the saved exchange rate untouched.
    setCurrency: (code: CurrencyCode, rate?: number) => void;
    company: Company;
    setCompany: (c: Company) => void;
    tax: number;
    setTax: (v: number) => void;
    printer: Printer;
    setPrinter: (p: Printer) => void;
};

const DataContext = createContext<DataState | null>(null);
export function DataProvider({ children }: { children: React.ReactNode }) {
    // SQLite-backed collections.
    const [cats, setCats] = useState<Category[]>([]);
    const [prods, setProds] = useState<Product[]>([]);
    const [custs, setCusts] = useState<Customer[]>([]);
    const [sups, setSups] = useState<Supplier[]>([]);
    const [grvz, setGrvz] = useState<GRV[]>([]);
    const [pos, setPos] = useState<PurchaseOrder[]>([]);
    const [stockLevels, setStockLevels] = useState<
        Record<string, db.StockLevel>
    >({});
    const [soldQty, setSoldQty] = useState<Record<string, number>>({});
    const [totalStockValue, setTotalStockValue] = useState(0);
    const [currencyCode, setCurrencyCode] = useState<CurrencyCode>("USD");
    const [exchangeRate, setExchangeRate] = useState(1);
    const backend = useRef<"sqlite" | "memory">("memory");

    const reloadCats = async () => setCats(await db.getCategories());
    const reloadProds = async () => setProds(await db.getProducts());
    const reloadCusts = async () => setCusts(await db.getCustomers());
    const reloadSups = async () => setSups(await db.getSuppliers());
    const reloadPos = async () => setPos(await db.getPurchaseOrders());
    // Stock is derived from the `stocks` ledger, so it must be recomputed whenever
    // GRVs change.
    const reloadStock = async () => {
        const [levels, value, sold] = await Promise.all([
            db.getStockLevels(),
            db.getTotalStockValue(),
            db.getSoldQuantities(),
        ]);
        setStockLevels(levels);
        setTotalStockValue(value);
        setSoldQty(sold);
    };
    const reloadGrvs = async () => {
        setGrvz(await db.getGRVs());
        await reloadStock();
    };
    // Persist a checkout and refresh stock (sold quantity changes available qty).
    const recordSale = async (sale: db.SaleInput) => {
        const id = await db.recordSale(sale);
        await reloadStock();
        return id;
    };
    const listSales = async (from?: string, to?: string) => {
        if (backend.current !== "sqlite") return [];
        return db.getSales(from, to);
    };
    const reverseSale = async (saleId: number) => {
        if (backend.current !== "sqlite") return;
        await db.reverseSale(saleId);
        await reloadStock(); // voided items return to available stock
    };
    // Receive a purchase order: create a GRV linked to the PO (which raises
    // stock via the stocks ledger) and flip the PO's status to 'received'.
    const receivePurchaseOrder = async ({
        po,
        items,
        date,
        supplierInvoiceNumber,
    }: {
        po: PurchaseOrder;
        items: LineItem[];
        date: string;
        supplierInvoiceNumber?: string;
    }) => {
        const total = items.reduce((n, i) => n + i.qty * i.unitCost, 0);
        if (backend.current === "sqlite") {
            await db.addGRV(
                { supplierId: po.supplierId, date, paymentMethod: po.paymentMethod, items, total },
                { purchaseOrderId: po.id, supplierInvoiceNumber },
            );
            await db.updatePurchaseOrderStatus(po.id, "received");
            await reloadGrvs(); // reloads GRVs + stock
            await reloadPos();
        } else {
            setGrvz((prev) => [
                {
                    id: uid("g"),
                    number: `GRN-${String(prev.length + 1).padStart(4, "0")}`,
                    supplierId: po.supplierId,
                    date,
                    paymentMethod: po.paymentMethod,
                    items,
                    total,
                },
                ...prev,
            ]);
            setPos((prev) =>
                prev.map((p) => (p.id === po.id ? { ...p, status: "received" } : p)),
            );
        }
    };

    const addStock = async (product: Product, quantity: number, note?: string) => {
        if (backend.current === "sqlite") {
            await db.addStock(product.id, quantity, note);
            await reloadProds();
            await reloadStock();
        } else {
            setProds((prev) =>
                prev.map((p) => (p.id === product.id ? { ...p, stock: p.stock + quantity } : p)),
            );
        }
    };

    const writeOffStock = async (product: Product, quantity: number, note?: string) => {
        if (backend.current === "sqlite") {
            await db.writeOffStock(product.id, quantity, note);
            await reloadProds();
            await reloadStock();
        } else {
            setProds((prev) =>
                prev.map((p) =>
                    p.id === product.id ? { ...p, stock: Math.max(0, p.stock - quantity) } : p,
                ),
            );
        }
    };

    // Switch the display currency. Applies immediately to the shared formatter
    // in theme.ts (so every `currency()` call reprices) and persists the choice
    // to SQLite settings so it survives restarts.
    const setCurrency = (code: CurrencyCode, rate?: number) => {
        // Preserve the saved rate when none is supplied (switching to USD must
        // not wipe the ZiG rate — USD is the base and ignores the rate anyway).
        const safeRate = rate != null && rate > 0 ? rate : exchangeRate > 0 ? exchangeRate : 1;
        setCurrencyConfig(code, safeRate);
        setCurrencyCode(code);
        setExchangeRate(safeRate);
        if (backend.current === "sqlite") {
            Promise.all([
                db.setAppSetting("currency_code", code),
                db.setAppSetting("exchange_rate", String(safeRate)),
            ]).catch(console.error);
        }
    };

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                await db.initDb();
                backend.current = "sqlite";
                const [c, p, cu, su, g, po, levels, value, sold, settings] = await Promise.all([
                    db.getCategories(),
                    db.getProducts(),
                    db.getCustomers(),
                    db.getSuppliers(),
                    db.getGRVs(),
                    db.getPurchaseOrders(),
                    db.getStockLevels(),
                    db.getTotalStockValue(),
                    db.getSoldQuantities(),
                    db.getAppSettings(),
                ]);
                // Apply the persisted display currency before first paint so all
                // prices render in the right currency immediately.
                const code: CurrencyCode = settings.currency_code === "ZiG" ? "ZiG" : "USD";
                const rate = Number(settings.exchange_rate) > 0 ? Number(settings.exchange_rate) : 1;
                setCurrencyConfig(code, rate);
                if (mounted) {
                    setCats(c);
                    setProds(p);
                    setCusts(cu);
                    setSups(su);
                    setGrvz(g);
                    setPos(po);
                    setStockLevels(levels);
                    setTotalStockValue(value);
                    setSoldQty(sold);
                    setCurrencyCode(code);
                    setExchangeRate(rate);
                }
            } catch (e) {
                console.warn(
                    "SQLite unavailable — falling back to in-memory data",
                    e,
                );
                backend.current = "memory";
                if (mounted) {
                    setCats(seed.categories);
                    setProds(seed.products);
                    setCusts(seed.customers);
                    setSups(seed.suppliers);
                    setGrvz(seed.grvs);
                    setPos(seed.purchaseOrders);
                }
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const categories: Collection<Category> = {
        items: cats,
        add: (item) => {
            if (backend.current === "sqlite")
                db.addCategory(item.name).then(reloadCats).catch(console.error);
            else setCats((prev) => [{ ...item, id: uid("c") }, ...prev]);
        },
        update: (id, patch) => {
            if (backend.current === "sqlite") {
                if (patch.name != null)
                    db.updateCategory(id, patch.name)
                        .then(reloadCats)
                        .catch(console.error);
            } else
                setCats((prev) =>
                    prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
                );
        },
        remove: (id) => {
            if (backend.current === "sqlite")
                db.deleteCategory(id).then(reloadCats).catch(console.error);
            else setCats((prev) => prev.filter((i) => i.id !== id));
        },
    };

    const products: Collection<Product> = {
        items: prods,
        add: (item) => {
            if (backend.current === "sqlite")
                db.addProduct(item).then(reloadProds).catch(console.error);
            else setProds((prev) => [{ ...item, id: uid("p") }, ...prev]);
        },
        update: (id, patch) => {
            if (backend.current === "sqlite") {
                const current = prods.find((p) => p.id === id);
                if (current) {
                    const { id: _drop, ...rest } = { ...current, ...patch };
                    db.updateProduct(id, rest)
                        .then(reloadProds)
                        .catch(console.error);
                }
            } else
                setProds((prev) =>
                    prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
                );
        },
        remove: (id) => {
            if (backend.current === "sqlite")
                db.deleteProduct(id).then(reloadProds).catch(console.error);
            else setProds((prev) => prev.filter((i) => i.id !== id));
        },
    };

    const customers: Collection<Customer> = {
        items: custs,
        add: (item) => {
            if (backend.current === "sqlite")
                db.addCustomer(item).then(reloadCusts).catch(console.error);
            else setCusts((prev) => [{ ...item, id: uid("cu") }, ...prev]);
        },
        update: (id, patch) => {
            if (backend.current === "sqlite") {
                const current = custs.find((c) => c.id === id);
                if (current) {
                    const { id: _drop, ...rest } = { ...current, ...patch };
                    db.updateCustomer(id, rest)
                        .then(reloadCusts)
                        .catch(console.error);
                }
            } else
                setCusts((prev) =>
                    prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
                );
        },
        remove: (id) => {
            if (backend.current === "sqlite")
                db.deleteCustomer(id).then(reloadCusts).catch(console.error);
            else setCusts((prev) => prev.filter((i) => i.id !== id));
        },
    };

    const suppliers: Collection<Supplier> = {
        items: sups,
        add: (item) => {
            if (backend.current === "sqlite")
                db.addSupplier(item).then(reloadSups).catch(console.error);
            else setSups((prev) => [{ ...item, id: uid("s") }, ...prev]);
        },
        update: (id, patch) => {
            if (backend.current === "sqlite") {
                const current = sups.find((s) => s.id === id);
                if (current) {
                    const { id: _drop, ...rest } = { ...current, ...patch };
                    db.updateSupplier(id, rest)
                        .then(reloadSups)
                        .catch(console.error);
                }
            } else
                setSups((prev) =>
                    prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
                );
        },
        remove: (id) => {
            if (backend.current === "sqlite")
                db.deleteSupplier(id).then(reloadSups).catch(console.error);
            else setSups((prev) => prev.filter((i) => i.id !== id));
        },
    };

    const grvs: Collection<GRV> = {
        items: grvz,
        add: (item) => {
            if (backend.current === "sqlite")
                db.addGRV(item).then(reloadGrvs).catch(console.error);
            else setGrvz((prev) => [{ ...item, id: uid("g") }, ...prev]);
        },
        update: (id, patch) => {
            // GRVs are immutable documents in the UI; only the in-memory fallback
            // supports patching.
            if (backend.current !== "sqlite") {
                setGrvz((prev) =>
                    prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
                );
            }
        },
        remove: (id) => {
            if (backend.current === "sqlite")
                db.deleteGRV(id).then(reloadGrvs).catch(console.error);
            else setGrvz((prev) => prev.filter((i) => i.id !== id));
        },
    };

    const purchaseOrders: Collection<PurchaseOrder> = {
        items: pos,
        add: (item) => {
            if (backend.current === "sqlite")
                db.addPurchaseOrder(item).then(reloadPos).catch(console.error);
            else setPos((prev) => [{ ...item, id: uid("po") }, ...prev]);
        },
        update: (id, patch) => {
            // Purchase orders are immutable documents in the UI; only the
            // in-memory fallback supports patching.
            if (backend.current !== "sqlite") {
                setPos((prev) =>
                    prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
                );
            }
        },
        remove: (id) => {
            if (backend.current === "sqlite")
                db.deletePurchaseOrder(id).then(reloadPos).catch(console.error);
            else setPos((prev) => prev.filter((i) => i.id !== id));
        },
    };

    const employees = useCollection<Employee>("e", seed.employees);
    const quotes = useCollection<Quote>("q", seed.quotes);

    const [company, setCompany] = useState<Company>(seed.company);
    const [tax, setTax] = useState<number>(seed.tax.value);
    const [printer, setPrinter] = useState<Printer>(seed.printer);

    // Opening stock + received via GRVs - sold via sales.
    const availableStock = (product: Product) =>
        product.stock + (stockLevels[product.id]?.received ?? 0) - (soldQty[product.id] ?? 0);

    const value = useMemo<DataState>(
        () => ({
            categories,
            products,
            customers,
            suppliers,
            employees,
            purchaseOrders,
            grvs,
            quotes,
            stockLevels,
            availableStock,
            totalStockValue,
            recordSale,
            listSales,
            reverseSale,
            receivePurchaseOrder,
            addStock,
            writeOffStock,
            currencyCode,
            exchangeRate,
            setCurrency,
            company,
            setCompany,
            tax,
            setTax,
            printer,
            setPrinter,
        }),
        [
            cats,
            prods,
            custs,
            sups,
            grvz,
            stockLevels,
            totalStockValue,
            soldQty,
            pos,
            employees,
            quotes,
            currencyCode,
            exchangeRate,
            company,
            tax,
            printer,
        ],
    );

    return (
        <DataContext.Provider value={value}>{children}</DataContext.Provider>
    );
}

export function useData() {
    const ctx = useContext(DataContext);
    if (!ctx) throw new Error("useData must be used within a DataProvider");
    return ctx;
}
