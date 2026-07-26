const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite's web implementation (wa-sqlite) ships a .wasm binary and
// needs SharedArrayBuffer, which requires the app to be cross-origin
// isolated. See https://docs.expo.dev/versions/latest/sdk/sqlite/#web-setup
config.resolver.assetExts.push("wasm");

config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    return middleware(req, res, next);
  };
};

module.exports = config;
