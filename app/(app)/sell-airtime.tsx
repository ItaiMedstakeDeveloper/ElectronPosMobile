import SellAirtimeScreen from "@/airtime/sell-airtime-screen";

// "Sell Airtime" — the airtime reseller mini-POS ported from the ScanIt app.
// It is fully self-contained (its own SQLite database `scannit.db` and dark
// theme), so it renders unchanged inside the POS shell.
export default function SellAirtime() {
    return <SellAirtimeScreen />;
}
