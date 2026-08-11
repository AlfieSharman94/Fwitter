/**
 * Polyfill for @aws-amplify/react-native native module
 * Provides JavaScript implementations for Expo Go compatibility
 */

const { BigInteger } = require('jsbn');

// Polyfill computeModPow - modular exponentiation for SRP
function computeModPow(base, exponent, modulus) {
  return new Promise((resolve, reject) => {
    try {
      const baseBigInt = new BigInteger(base, 16);
      const exponentBigInt = new BigInteger(exponent, 16);
      const modulusBigInt = new BigInteger(modulus, 16);
      
      // Compute base^exponent mod modulus
      const result = baseBigInt.modPow(exponentBigInt, modulusBigInt);
      
      // Return as hex string (ensure even length)
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

// Export as a native module-like object
module.exports = {
  computeModPow,
  // Add other methods if needed
};
