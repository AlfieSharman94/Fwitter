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
  
  // Check if the resolved path is the native module we want to replace
  const isNativeModule = 
    realModuleName === '@aws-amplify/react-native/dist/cjs/nativeModule' ||
    realModuleName.includes('@aws-amplify/react-native/dist/cjs/nativeModule') ||
    (realModuleName.includes('@aws-amplify/react-native') && realModuleName.includes('nativeModule')) ||
    // Handle relative imports from within the package
    (context.originModulePath && 
     context.originModulePath.includes('@aws-amplify/react-native') && 
     (realModuleName === '../nativeModule' || realModuleName === './nativeModule' || realModuleName.endsWith('/nativeModule'))) ||
    // Check if resolved path points to the native module file
    (resolved && resolved.filePath && resolved.filePath.includes('@aws-amplify/react-native') && resolved.filePath.includes('nativeModule.js'));
  
  if (isNativeModule) {
    console.log('[Metro] Intercepting native module:', realModuleName, '-> polyfill');
    return {
      filePath: path.resolve(__dirname, 'src/polyfills/native-module-proxy.js'),
      type: 'sourceFile',
    };
  }
  
  // Return the original resolution
  return resolved || resolve(context, realModuleName, platform);
};

module.exports = config;
