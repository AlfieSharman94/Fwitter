console.log("ENTRY index.js running");

// Load required polyfills BEFORE expo-router/entry
require("react-native-get-random-values");
require("react-native-url-polyfill/auto");

// CRITICAL: Patch NativeModules.AmplifyRTNCore BEFORE any Amplify code loads
// We need to do this using Object.defineProperty to bypass React Native's Proxy restrictions
const { NativeModules } = require("react-native");
const jsbn = require("jsbn");

// Create polyfill functions
const computeModPow = (payload) => {
  return new Promise((resolve, reject) => {
    try {
      const { base, exponent, divisor } = payload;
      const baseBigInt = new jsbn.BigInteger(base, 16);
      const exponentBigInt = new jsbn.BigInteger(exponent, 16);
      const divisorBigInt = new jsbn.BigInteger(divisor, 16);
      const result = baseBigInt.modPow(exponentBigInt, divisorBigInt);
      let hexResult = result.toString(16);
      if (hexResult.length % 2 !== 0) {
        hexResult = '0' + hexResult;
      }
      resolve(hexResult);
    } catch (error) {
      reject(new Error(`computeModPow failed: ${error.message}`));
    }
  });
};

const computeS = (payload) => {
  return new Promise((resolve, reject) => {
    try {
      const { g, x, k, a, b, u } = payload;
      const N = new jsbn.BigInteger('FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF', 16);
      const gBigInt = new jsbn.BigInteger(g, 16);
      const xBigInt = new jsbn.BigInteger(x, 16);
      const kBigInt = new jsbn.BigInteger(k, 16);
      const aBigInt = new jsbn.BigInteger(a, 16);
      const bBigInt = new jsbn.BigInteger(b, 16);
      const uBigInt = new jsbn.BigInteger(u, 16);
      const gx = gBigInt.modPow(xBigInt, N);
      const kgx = kBigInt.multiply(gx).mod(N);
      const B = bBigInt.subtract(kgx).mod(N);
      const aux = aBigInt.add(uBigInt.multiply(xBigInt));
      const result = B.modPow(aux, N);
      let hexResult = result.toString(16);
      if (hexResult.length % 2 !== 0) {
        hexResult = '0' + hexResult;
      }
      resolve(hexResult);
    } catch (error) {
      reject(new Error(`computeS failed: ${error.message}`));
    }
  });
};

// Try to set AmplifyRTNCore using Object.defineProperty to bypass Proxy restrictions
try {
  if (!NativeModules.AmplifyRTNCore) {
    Object.defineProperty(NativeModules, 'AmplifyRTNCore', {
      value: {
        computeModPow,
        computeS,
        getDeviceName: () => Promise.resolve('Expo Go'),
      },
      writable: false,
      enumerable: true,
      configurable: false,
    });
    console.log("AmplifyRTNCore native module polyfilled via defineProperty");
  }
} catch (e) {
  console.warn("Could not set AmplifyRTNCore via defineProperty:", e.message);
  // Fallback: try direct assignment (might not work but worth trying)
  try {
    NativeModules.AmplifyRTNCore = {
      computeModPow,
      computeS,
      getDeviceName: () => Promise.resolve('Expo Go'),
    };
    console.log("AmplifyRTNCore native module polyfilled via direct assignment");
  } catch (e2) {
    console.error("Failed to polyfill AmplifyRTNCore:", e2.message);
  }
}

// Load Amplify React Native adapter
// It should now find our polyfilled AmplifyRTNCore in NativeModules
try {
  require("@aws-amplify/react-native");
  console.log("@aws-amplify/react-native loaded");
} catch (e) {
  console.warn("Could not load @aws-amplify/react-native:", e.message);
}

console.log("Polyfills loaded, starting Expo Router...");

require("expo-router/entry");
