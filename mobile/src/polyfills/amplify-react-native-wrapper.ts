// Wrapper that provides the same API as @aws-amplify/react-native
// but uses JavaScript implementations for Expo Go

import { computeModPow, loadGetRandomValues, loadBase64, getRandomBytes } from './amplify-react-native';

// Call loadBase64 immediately to set up base64 encoding
loadBase64();
loadGetRandomValues();

// Export the same API that @aws-amplify/react-native exports
export { computeModPow, loadGetRandomValues, loadBase64, getRandomBytes };

// Also export as default for compatibility
export default {
  computeModPow,
  loadGetRandomValues,
  loadBase64,
  getRandomBytes,
};
