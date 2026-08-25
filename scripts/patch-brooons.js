/**
 * Postinstall patch for @brooons/react-native-bluetooth-escpos-printer.
 *
 * The published package ships an ancient android/build.gradle that pins
 * com.android.tools.build:gradle:3.1.4 in its own buildscript block. That AGP
 * no longer resolves from Google Maven and is incompatible with the app's
 * Expo SDK 54 / RN 0.81 / AGP 8 toolchain, so the Gradle build hangs/fails on
 * the `:brooons_react-native-bluetooth-escpos-printer` module.
 *
 * We overwrite that build.gradle with a modern one (inherits AGP from the root
 * project, AndroidX, `namespace`) and strip the deprecated `package` attribute
 * from the library manifest (AGP 8 requires the namespace in build.gradle).
 *
 * Runs on every `npm install` so the fix survives reinstalls. No-ops quietly if
 * the library isn't installed. Uses only Node's fs so it needs no dependency.
 */
const fs = require("fs");
const path = require("path");

const androidDir = path.join(
  __dirname,
  "..",
  "node_modules",
  "@brooons",
  "react-native-bluetooth-escpos-printer",
  "android",
);

if (!fs.existsSync(androidDir)) {
  // Library not installed yet — nothing to patch.
  process.exit(0);
}

const patchesDir = path.join(__dirname, "..", "patches", "brooons");

try {
  fs.copyFileSync(
    path.join(patchesDir, "build.gradle"),
    path.join(androidDir, "build.gradle"),
  );
  fs.copyFileSync(
    path.join(patchesDir, "AndroidManifest.xml"),
    path.join(androidDir, "src", "main", "AndroidManifest.xml"),
  );
  console.log(
    "[patch-brooons] Applied modern Gradle config to the Bluetooth printer library.",
  );
} catch (e) {
  console.warn("[patch-brooons] Could not apply patch:", e.message);
}
