// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite ships a WebAssembly build (wa-sqlite) for the web target. Metro
// does not treat `.wasm` as an asset by default, so the `import ...wa-sqlite.wasm`
// inside expo-sqlite fails to resolve when bundling for web. Registering the
// extension lets Metro bundle it.
config.resolver.assetExts.push('wasm');

// wa-sqlite relies on SharedArrayBuffer, which browsers only expose in a
// cross-origin isolated context. Send the required COOP/COEP headers from the
// dev server so SQLite works when running `expo start --web`.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
