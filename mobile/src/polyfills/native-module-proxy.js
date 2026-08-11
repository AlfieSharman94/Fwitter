/**
 * Polyfill for @aws-amplify/react-native's native module
 * This replaces the native module file to provide JS implementations for Expo Go
 * 
 * This file must export the same structure as:
 * node_modules/@aws-amplify/react-native/dist/cjs/nativeModule.js
 */

'use strict';

const jsbn = require('jsbn');

// Polyfill computeModPow using jsbn
// The payload contains: { base, exponent, divisor } as hex strings
function computeModPow(payload) {
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
}

// Polyfill computeS - SRP calculation
// Payload: { g, x, k, a, b, u }
// Formula: S = (B - k * g^x) ^ (a + u * x) mod N
// Where N is the SRP modulus (standard 2048-bit)
function computeS(payload) {
  return new Promise((resolve, reject) => {
    try {
      const { g, x, k, a, b, u } = payload;
      
      // Standard SRP modulus (2048-bit)
      const N = new jsbn.BigInteger('FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF', 16);
      
      const gBigInt = new jsbn.BigInteger(g, 16);
      const xBigInt = new jsbn.BigInteger(x, 16);
      const kBigInt = new jsbn.BigInteger(k, 16);
      const aBigInt = new jsbn.BigInteger(a, 16);
      const bBigInt = new jsbn.BigInteger(b, 16);
      const uBigInt = new jsbn.BigInteger(u, 16);
      
      // Compute g^x mod N
      const gx = gBigInt.modPow(xBigInt, N);
      
      // Compute B - k * g^x mod N
      const kgx = kBigInt.multiply(gx).mod(N);
      const B = bBigInt.subtract(kgx).mod(N);
      
      // Compute a + u * x
      const aux = aBigInt.add(uBigInt.multiply(xBigInt));
      
      // Compute S = B^(a + u*x) mod N
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
}

// Create a mock native module that matches the expected API
// This mimics what NativeModules.AmplifyRTNCore would provide
const nativeModule = {
  computeModPow,
  computeS,
  getDeviceName: () => Promise.resolve('Expo Go'),
};

// Export the same structure as the real native module file
// The real file exports: exports.nativeModule = NativeModules.AmplifyRTNCore || Proxy
Object.defineProperty(exports, "__esModule", { value: true });
exports.nativeModule = nativeModule;
