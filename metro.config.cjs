const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Provide Polyfills for Node.js built-ins to support GramJS in React Native
config.resolver.extraNodeModules = {
  crypto: require.resolve("crypto-browserify"),
  stream: require.resolve("stream-browserify"),
  buffer: require.resolve("buffer"),
  events: require.resolve("events"),
  path: require.resolve("path-browserify"),
  os: require.resolve("os-browserify/browser"),
  zlib: require.resolve("browserify-zlib"),
  fs: path.resolve(__dirname, "empty-module.js"),
  net: path.resolve(__dirname, "empty-module.js"),
  tls: path.resolve(__dirname, "empty-module.js"),
  child_process: path.resolve(__dirname, "empty-module.js"),
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
