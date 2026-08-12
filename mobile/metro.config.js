// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { resolve } = require('metro-resolver');

const config = getDefaultConfig(__dirname);

// Custom resolver that intercepts the native module
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, realModuleName, platform, moduleName) => {
  // First, try to resolve normally to get the actual file path
  let resolved;
  try {
    if (originalResolveRequest) {
      resolved = originalResolveRequest(context, realModuleName, platform, moduleName);
    } else {
      resolved = resolve(context, realModuleName, platform);
    }
  } catch (e) {
    // If resolution fails, try our polyfill
    resolved = null;
  }
  
  // Prefer the real native module whenever it actually resolved. It only fails to
  // resolve in environments with no custom native modules (Expo Go) — a standalone
  // or dev-client build (including EAS/TestFlight builds) has the real compiled
  // module available and should always use it: it's the fast native SRP crypto
  // implementation, vs. the JS polyfill below which does 2048-bit modular
  // exponentiation synchronously on the JS thread and can block the app for a
  // very long time during sign-in.
  if (resolved) {
    return resolved;
  }

  // Resolution failed — check if this is the native module we know how to polyfill
  // for Expo Go (which can't load custom native modules at all).
  const isNativeModule =
    realModuleName === '@aws-amplify/react-native/dist/cjs/nativeModule' ||
    realModuleName.includes('@aws-amplify/react-native/dist/cjs/nativeModule') ||
    (realModuleName.includes('@aws-amplify/react-native') && realModuleName.includes('nativeModule')) ||
    // Handle relative imports from within the package
    (context.originModulePath &&
     context.originModulePath.includes('@aws-amplify/react-native') &&
     (realModuleName === '../nativeModule' || realModuleName === './nativeModule' || realModuleName.endsWith('/nativeModule')));

  if (isNativeModule) {
    console.log('[Metro] Native module unresolved (Expo Go?) — using JS polyfill:', realModuleName);
    return {
      filePath: path.resolve(__dirname, 'src/polyfills/native-module-proxy.js'),
      type: 'sourceFile',
    };
  }

  // Truly unresolved and not something we have a polyfill for — let it fail naturally.
  return resolve(context, realModuleName, platform);
};

module.exports = config;
