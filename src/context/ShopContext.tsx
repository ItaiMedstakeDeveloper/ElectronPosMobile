import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import * as meta from "@/db/meta";
import * as db from "@/db/db";
import type { Shop } from "@/db/meta";

// Owns the multi-shop layer: the list of shops, which one is active, and the
// actions to create / switch / set-default / delete. It initialises the meta
// store on boot and points the data layer (db.ts) at the active shop's file
// BEFORE rendering the data providers, so everything downstream loads the right
// shop. Switching a shop changes `activeShopId`, which the root layout uses as a
// React key to remount the data providers against the new file.

type ShopState = {
    ready: boolean;
    shops: Shop[];
    activeShop: Shop | null;
    activeShopId: string | null;
    switching: boolean;
    // Bumped after a restore to force the data providers to remount and reload
    // from the freshly-written database files (see app/_layout.tsx).
    reloadNonce: number;
    refresh: () => Promise<void>;
    createShop: (input: {
        name: string;
        address?: string;
        phone?: string;
    }) => Promise<Shop>;
    switchShop: (id: string) => Promise<void>;
    setDefault: (id: string) => Promise<void>;
    removeShop: (id: string) => Promise<void>;
    // Re-read the shop registry and reload all data after a backup restore.
    reloadAfterRestore: () => Promise<void>;
};

const ShopContext = createContext<ShopState | null>(null);

export function ShopProvider({ children }: { children: React.ReactNode }) {
    const [ready, setReady] = useState(false);
    const [shops, setShops] = useState<Shop[]>([]);
    const [activeShopId, setActiveShopId] = useState<string | null>(null);
    const [switching, setSwitching] = useState(false);
    const [reloadNonce, setReloadNonce] = useState(0);

    const refresh = async () => {
        setShops(await meta.listShops());
    };

    // Boot: initialise + migrate the meta store, then select the active shop and
    // point the data layer at its file before we let the data providers mount.
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                await meta.initMeta();
                const list = await meta.listShops();
                const activeId = await meta.getActiveShopId();
                const active =
                    list.find((s) => s.id === activeId) ??
                    list.find((s) => s.isDefault) ??
                    list[0] ??
                    null;
                if (active) db.setActiveDbFile(active.dbFile);
                if (mounted) {
                    setShops(list);
                    setActiveShopId(active?.id ?? null);
                    setReady(true);
                }
            } catch (e) {
                console.error("Shop initialisation failed", e);
                // Fall back so the app still boots on the default file.
                if (mounted) setReady(true);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const switchShop = async (id: string) => {
        const shop = shops.find((s) => s.id === id);
        if (!shop || id === activeShopId) return;
        setSwitching(true);
        try {
            await meta.setActiveShop(id);
            db.setActiveDbFile(shop.dbFile);
            // Changing the id remounts the data providers (keyed in the root
            // layout), which re-inits the DB and reloads everything.
            setActiveShopId(id);
        } finally {
            setSwitching(false);
        }
    };

    const createShop = async (input: {
        name: string;
        address?: string;
        phone?: string;
    }) => {
        const shop = await meta.createShop(input);
        // A newly created shop becomes the default and the active shop.
        await meta.setDefaultShop(shop.id);
        await meta.setActiveShop(shop.id);
        db.setActiveDbFile(shop.dbFile);
        await refresh();
        setActiveShopId(shop.id); // remount -> initDb seeds the new file
        return shop;
    };

    const setDefault = async (id: string) => {
        await meta.setDefaultShop(id);
        await refresh();
    };

    const removeShop = async (id: string) => {
        await meta.deleteShop(id);
        await refresh();
    };

    // Called after a backup has overwritten the database files. Re-reads the shop
    // registry, points the data layer at the (possibly changed) active shop, and
    // bumps the nonce so the data providers remount and reload from disk.
    const reloadAfterRestore = async () => {
        try {
            const list = await meta.listShops();
            const activeId = await meta.getActiveShopId();
            const active =
                list.find((s) => s.id === activeId) ??
                list.find((s) => s.isDefault) ??
                list[0] ??
                null;
            if (active) db.setActiveDbFile(active.dbFile);
            setShops(list);
            setActiveShopId(active?.id ?? null);
            setReloadNonce((n) => n + 1);
        } catch (e) {
            console.error("Reload after restore failed", e);
        }
    };

    const activeShop = useMemo(
        () => shops.find((s) => s.id === activeShopId) ?? null,
        [shops, activeShopId],
    );

    const value = useMemo<ShopState>(
        () => ({
            ready,
            shops,
            activeShop,
            activeShopId,
            switching,
            reloadNonce,
            refresh,
            createShop,
            switchShop,
            setDefault,
            removeShop,
            reloadAfterRestore,
        }),
        [ready, shops, activeShop, activeShopId, switching, reloadNonce],
    );

    return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopState {
    const ctx = useContext(ShopContext);
    if (!ctx) throw new Error("useShop must be used within a ShopProvider");
    return ctx;
}
