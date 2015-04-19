// Copyright 2015 Mika "Fincodr" Luoma-aho
// Provided under the MIT license. See LICENSE file for details.
(function(parent){
  "use strict";

  // The main application module
  var app = parent.app = parent.app || {};

  // fix safari crypto namespace
  //
  if (window.crypto && !window.crypto.subtle && window.crypto.webkitSubtle) {
    window.crypto.subtle = window.crypto.webkitSubtle;
  }

  /**
   * Detect Web Cryptography API
   * @return {Boolean} true, if success
   */
  function isWebCryptoAPISupported() {
    return 'crypto' in window && 'subtle' in window.crypto;
  }

  // crypto module
  app.cryptography = (function(){

    var self = this;

    var module = {

      checkSupport: function() {
        // TODO: implement the actual algorithm support checking
        // by running different tests.
        return true;
      },

      isSupported: function() {
        // check that we have crypto interface
        if ("crypto" in window) {
          // check that we have subtleCryto interface
          if ("subtle" in window.crypto) {
            // check that we can use RSA-OAEP algorithm with encrypt, decrypt, sign, digest, generateKey, exportKey
            var algo = ["RSA-OAEP"];
            var methods = ["encrypt", "decrypt", "sign", "digest", "generateKey", "exportKey"];
            var keyUsage = ["encrypt", "decrypt"];
            if (module.checkSupport(algo, methods, {keyUsage: keyUsage})) {
              return true;
            }
          }
        }
        return false;
      },

      returnResolve: function(value) {
        return new Promise(function(resolve, reject) {
          resolve(value);
        });
      },

      digest: function(alg, data) {
        return window.crypto.subtle.digest(
          alg,
          data
        );
      },

      generateKeys: function(alg, exportable, usage) {
        return window.crypto.subtle.generateKey(
          alg, // algorithm
          exportable, // non-exportable
          usage // usage
        );
      },

      importKey: function(key, alg, format, exportable, usage) {
        return window.crypto.subtle.importKey(
          format, // raw format
          key, // key to import
          alg, // algorithm
          exportable, // exportable
          usage // key usages
        );
      },

      exportKey: function(key, format) {
        return window.crypto.subtle.exportKey(
          format, // raw format
          key // key to export
        );
      },

      encryptData: function(alg, key, inputData) {
        return window.crypto.subtle.encrypt(
          alg, // algorithm
          key, // key to use for encryption
          inputData // input data
        );
      },

      decryptData: function(alg, key, inputData) {
        return window.crypto.subtle.decrypt(
          alg, // algorithm
          key, // key to use for decryption
          inputData // input data
        );
      },

      signData: function(alg, key, inputData) {
        return window.crypto.subtle.sign(
          alg, // algorithm
          key, // key to use for signing
          inputData // input data
        );
      },

      exportIdentity: function(publicKey, privateKey, signingKey, verifyKey) {
        return new Promise(function(resolve, reject) {
          var exported = {};

          function exportKeyOrContinue(key, format, c, k) {
            return new Promise(function(done, fail) {
              // Try to export publicKey
              module.exportKey(key, format)
              .then(function(result) {
                c[k] = new Uint8Array(result);
                done();
              })
              .catch(function(err) { done(); });
            });
          }

          exportKeyOrContinue(publicKey, 'spki', exported, 'publicKeyData')
          .then(function(result) {
            return exportKeyOrContinue(privateKey, 'pkcs8', exported, 'privateKeyData');
          })
          .then(function(result) {
            return exportKeyOrContinue(verifyKey, 'spki', exported, 'verifyKeyData');
          })
          .then(function(result) {
            return exportKeyOrContinue(signingKey, 'pkcs8', exported, 'signingKeyData');
          })
          .then(function(){
            // Concat arrays
            exported.publicIdentityData = app.utils.packUint8Arrays(
              exported.publicKeyData,
              exported.verifyKeyData
            );
            exported.privateIdentityData = app.utils.packUint8Arrays(
              exported.privateKeyData,
              exported.signingKeyData
            );
            resolve(exported);
          });
        });
      },

      importIdentity: function(asymAlg, signingAlg, publicIdentityData, privateIdentityData, exportablePrivateIdentity) {
        return new Promise(function(resolve, reject) {
          var imported = {};

          function importKeyOrContinue(key, alg, format, exportable, usage) {
            return new Promise(function(done, fail) {
              // Try to import key
              module.importKey(key, alg, format, exportable, usage)
              .then(function(result) { done(result); })
              .catch(function(err) { done(); });
            });
          }

          var publicIdentity = app.utils.unpackUint8Arrays(publicIdentityData);
          var privateIdentity = app.utils.unpackUint8Arrays(privateIdentityData);

          imported = {
            publicKeyData: publicIdentity[0],
            verifyKeyData: publicIdentity[1],
            privateKeyData: privateIdentity[0],
            signingKeyData: privateIdentity[1]
          };

          importKeyOrContinue(imported.publicKeyData, asymAlg, 'spki', true, ['encrypt'])
          .then(function(result) {
            imported.publicKey = result;
            return importKeyOrContinue(imported.verifyKeyData, signingAlg, 'spki', true, ['verify']);
          })
          .then(function(result) {
            imported.verifyKey = result;
            return importKeyOrContinue(imported.privateKeyData, asymAlg, 'pkcs8', exportablePrivateIdentity, ['decrypt']);
          })
          .then(function(result) {
            imported.privateKey = result;
            return importKeyOrContinue(imported.signingKeyData, signingAlg, 'pkcs8', exportablePrivateIdentity, ['sign']);
          })
          .then(function(result) {
            imported.signingKey = result;
            resolve(imported);
          });
        });
      },

      verifyData: function(alg, key, digitalSignature, inputData) {
        return window.crypto.subtle.verify(
          alg, // algorithm
          key, // key to use for signing
          digitalSignature,
          inputData // input data
        );
      },

      encryptAndSign: function(asymAlg, symAlg, signingAlg, plaintext, encryptionKey, signingKey, verifyKey, publicKey) {
        return new Promise(function(resolve, reject) {

          var state = {};
          state.plaintextUint8Array = app.utils.convertTextToUint8Array(plaintext);

          // generate IV for symmetric encryption
          state.symmetricIV = window.crypto.getRandomValues(new Uint8Array(16));

          module.generateKeys(symAlg, true, ['encrypt', 'decrypt'])
          .then(function(symmetricKey) {
            state.symmetricKey = symmetricKey;
            return module.exportKey(state.symmetricKey, 'raw');
          })
          .then(function(exportedSymmetricKey) {
            state.exportedSymmetricKey = new Uint8Array(exportedSymmetricKey);
            if (verifyKey) {
              return module.exportKey(verifyKey, 'spki');
            } else {
              return module.returnResolve(false);
            }
          })
          .then(function(exportedVerifyKey) {
            if (signingKey) {
              state.exportedVerifyKey = new Uint8Array(exportedVerifyKey);
              return module.signData(signingAlg, signingKey, state.plaintextUint8Array);
            } else {
              state.exportedVerifyKey = new Uint8Array();
              return module.returnResolve();
            }
          })
          .then(function(digitalSignature) {
            state.digitalSignature = new Uint8Array(digitalSignature);
            if (publicKey) {
              return module.exportKey(publicKey, 'spki');
            } else {
              return module.returnResolve();
            }
          })
          .then(function(exportedPublicKey) {
            state.exportedPublicKey = new Uint8Array(exportedPublicKey);
            if (state.exportedPublicKey) {
              state.dataToEncrypt = app.utils.packUint8Arrays(
                state.plaintextUint8Array,
                state.digitalSignature,
                state.exportedVerifyKey,
                state.exportedPublicKey
              );
            } else {
              state.dataToEncrypt = app.utils.packUint8Arrays(
                state.plaintextUint8Array,
                state.digitalSignature,
                state.exportedVerifyKey
              );
            }
            symAlg.iv = state.symmetricIV;
            return module.encryptData(symAlg, state.symmetricKey, state.dataToEncrypt);
          })
          .then(function(encryptedDataArray) {
            state.encryptedPlaintextAndDigitalSignatureAndVerifyKey = new Uint8Array(encryptedDataArray);
            state.symmetricKeyAndIVpack = app.utils.packUint8Arrays(
              state.exportedSymmetricKey,
              state.symmetricIV
            );
            return module.encryptData(encryptionKey.algorithm, encryptionKey, state.symmetricKeyAndIVpack);
          })
          .then(function(encryptedSymmetricKeyAndIVArray) {
            state.encryptedSymmetricKeyAndIV = new Uint8Array(encryptedSymmetricKeyAndIVArray);
            state.packedCipher = app.utils.packUint8Arrays(
              state.encryptedPlaintextAndDigitalSignatureAndVerifyKey,
              state.encryptedSymmetricKeyAndIV
            );
            resolve(state);
          })
          .catch(function(err) {
            reject(err);
          });
        });
      },

      decryptAndVerify: function(asymAlg, symAlg, signingAlg, digestAlg, packedCipher, decryptionKey) {
        return new Promise(function(resolve, reject) {
          var state = {};

          var unpackedCipher = app.utils.unpackUint8Arrays(packedCipher);

          state.encryptedPlaintextAndDigitalSignatureAndVerifyKey = unpackedCipher[0];
          state.encryptedSymmetricKeyAndIV = unpackedCipher[1];

          module.decryptData(decryptionKey.algorithm, decryptionKey, state.encryptedSymmetricKeyAndIV)
          .then(function(result) {
            var symmetricKeyAndIV = app.utils.unpackUint8Arrays(new Uint8Array(result));
            state.symmetricKeyData = symmetricKeyAndIV[0];
            state.symmetricIV = symmetricKeyAndIV[1];
            return module.importKey(state.symmetricKeyData, symAlg, 'raw', false, ['decrypt']);
          })
          .then(function(result) {
            state.symmetricKey = result;
            symAlg.iv = state.symmetricIV;
            return module.decryptData(symAlg, state.symmetricKey, state.encryptedPlaintextAndDigitalSignatureAndVerifyKey);
          })
          .then(function(result) {
            var plaintextAndDigitalSignatureAndVerifyKey = app.utils.unpackUint8Arrays(new Uint8Array(result));
            state.plaintextUint8Array = plaintextAndDigitalSignatureAndVerifyKey[0];
            state.digitalSignature = plaintextAndDigitalSignatureAndVerifyKey[1];
            state.verifyKeyData = plaintextAndDigitalSignatureAndVerifyKey[2];
            if (plaintextAndDigitalSignatureAndVerifyKey.length > 3) {
              state.publicKeyData = plaintextAndDigitalSignatureAndVerifyKey[3];
            } else {
              state.publicKeyData = undefined;
            }
            if (state.digitalSignature.length!==0) {
              return module.digest(digestAlg, state.verifyKeyData);
            } else {
              return module.returnResolve();
            }
          })
          .then(function(hash) {
            state.verifyKeyFingerprint = new Uint8Array(hash);
            if (state.publicKeyData) {
              return module.importKey(state.publicKeyData, asymAlg, 'spki', false, ['encrypt']);
            } else {
              return module.returnResolve();
            }
          })
          .then(function(publicKey) {
            state.publicKey = publicKey;
            if (publicKey) {
              return module.digest(digestAlg, state.publicKeyData);
            } else {
              return module.returnResolve();
            }
          })
          .then(function(hash) {
            state.publicKeyFingerprint = new Uint8Array(hash);
            if (state.digitalSignature.length!==0) {
              return module.importKey(state.verifyKeyData, signingAlg, 'spki', true, ['verify']);
            } else {
              return module.returnResolve();
            }
          })
          .then(function(result) {
            if (state.digitalSignature.length!==0) {
              state.verifyKey = result;
              return module.verifyData(signingAlg, state.verifyKey, state.digitalSignature, state.plaintextUint8Array);
            } else {
              return module.returnResolve(false);
            }
          })
          .then(function(result) {
            state.digitalSignatureValid = result;
            resolve(state);
          })
          .catch(function(err){
            reject(err);
          });
        });
      }

    };

    return module;

  })();

})(this); // this = window


