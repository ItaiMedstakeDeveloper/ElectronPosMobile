import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

// Local (on-device) notifications for low-stock alerts. The app is fully
// offline, so these fire while the app is running whenever a product drops to or
// below its threshold (see DataContext). Web is a no-op — expo-notifications has
// no real support there.

let permissionGranted = false;
let configured = false;

// Set up the foreground handler, the Android channel, and request permission.
// Safe to call more than once; the heavy work runs only on the first call.
export async function initNotifications(): Promise<void> {
    if (Platform.OS === "web") return;
    if (configured) return;
    configured = true;

    // Show alerts even when the app is in the foreground.
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });

    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("low-stock", {
            name: "Low stock alerts",
            importance: Notifications.AndroidImportance.DEFAULT,
        });
    }

    try {
        const current = await Notifications.getPermissionsAsync();
        let status = current.status;
        if (status !== "granted") {
            const requested = await Notifications.requestPermissionsAsync();
            status = requested.status;
        }
        permissionGranted = status === "granted";
    } catch {
        permissionGranted = false;
    }
}

// Post an immediate low-stock notification for one product. No-ops on web or if
// permission was denied.
export async function notifyLowStock(
    productName: string,
    qty: number,
    threshold: number,
): Promise<void> {
    if (Platform.OS === "web" || !permissionGranted) return;
    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Low stock",
                body: `${productName} is low — ${qty} left (alert at ${threshold}).`,
            },
            trigger: null, // deliver now
        });
    } catch {
        /* notification failed — non-fatal */
    }
}
