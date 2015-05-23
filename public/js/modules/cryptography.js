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

      isSupported: function() {
        // check that we have Crypto interface
        if ("crypto" in window) {
          // check that we have SubtleCryto interface
          if ("subtle" in window.crypto) {
            return true;
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
            if (!exported.verifyKeyData) {
              exported.publicIdentityData = app.utils.packUint8Arrays(
                exported.publicKeyData
              );
            } else {
              exported.publicIdentityData = app.utils.packUint8Arrays(
                exported.publicKeyData,
                exported.verifyKeyData
              );
            }
            if (!exported.signingKeyData) {
              exported.privateIdentityData = app.utils.packUint8Arrays(
                exported.privateKeyData
              );
            } else {
              exported.privateIdentityData = app.utils.packUint8Arrays(
                exported.privateKeyData,
                exported.signingKeyData
              );
            }
            resolve(exported);
          })
          .catch(function(err){
            reject(err);
          });
        });
      },

      importIdentity: function(asymAlg, signingAlg, publicIdentityData, privateIdentityData, exportablePrivateIdentity) {
        return new Promise(function(resolve, reject) {
          var imported = {};

          function importKeyOrContinue(key, alg, format, exportable, usage) {
            return new Promise(function(done, fail) {
              if (key) {
                // Try to import key
                module.importKey(key, alg, format, exportable, usage)
                .then(function(result) { done(result); })
                .catch(function(err) { done(); });
              } else {
                // Fail but continue
                done();
              }
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

          state.signed = signingKey?true:false;
          state.hasSignature = state.signed?true:false;
          state.hasPublicKey = publicKey?true:false;

          // generate IV for symmetric encryption (symmetricIV)
          state.symmetricIV = window.crypto.getRandomValues(new Uint8Array(16));

          // generate symmetric key (symmetricKey)
          module.generateKeys(symAlg, true, ['encrypt', 'decrypt'])
          .then(function(symmetricKey) {
            state.symmetricKey = symmetricKey;
            // export generated key
            return module.exportKey(state.symmetricKey, 'raw');
          })
          .then(function(exportedSymmetricKey) {
            state.exportedSymmetricKey = new Uint8Array(exportedSymmetricKey);
            if (state.signed && verifyKey) {
              // if verify-key is provided, export the key
              return module.exportKey(verifyKey, 'spki');
            } else {
              // if verify-key is not provided, continue to next step
              return module.returnResolve(false);
            }
          })
          .then(function(exportedVerifyKey) {
            if (state.signed && verifyKey) {
              state.exportedVerifyKey = new Uint8Array(exportedVerifyKey);
              // if signing-key was provided, sign the plaintext
              return module.signData(signingAlg, signingKey, state.plaintextUint8Array);
            } else {
              // if signing-key was not provided, continue to next step
              state.exportedVerifyKey = new Uint8Array();
              return module.returnResolve();
            }
          })
          .then(function(digitalSignature) {
            state.digitalSignature = new Uint8Array(digitalSignature);
            if (state.hasPublicKey) {
              // if public-key was provided, export the key
              return module.exportKey(publicKey, 'spki');
            } else {
              // if public-key was not provided, continue to next step
              return module.returnResolve();
            }
          })
          .then(function(exportedPublicKey) {
            if (state.hasPublicKey) {
              state.exportedPublicKey = new Uint8Array(exportedPublicKey);
            }
            if (state.signed) {
              // if signing, create package from: [ plaintext, digitalsignature, verifyKey, (optional)publicKey ]
              state.dataToEncrypt = app.utils.packUint8Arrays(
                new Uint8Array([1, state.hasPublicKey?1:0]),
                state.plaintextUint8Array,
                state.digitalSignature,
                state.exportedVerifyKey,
                state.exportedPublicKey
              );
            } else {
              // if not signing, create package from: [ plaintext, (optional)publicKey ]
              state.dataToEncrypt = app.utils.packUint8Arrays(
                new Uint8Array([0, state.hasPublicKey?1:0]),
                state.plaintextUint8Array,
                state.exportedPublicKey
              );
            }
            symAlg.iv = state.symmetricIV;
            // encrypt the package that was created on previous step
            return module.encryptData(symAlg, state.symmetricKey, state.dataToEncrypt);
          })
          .then(function(encryptedDataArray) {
            state.encryptedPlaintextAndDigitalSignatureAndVerifyKey = new Uint8Array(encryptedDataArray);
            // create package from: [ symmetricKey, symmetricIV ]
            state.symmetricKeyAndIVpack = app.utils.packUint8Arrays(
              state.exportedSymmetricKey,
              state.symmetricIV
            );
            // encrypt the package that was created on the previous step
            return module.encryptData(encryptionKey.algorithm, encryptionKey, state.symmetricKeyAndIVpack);
          })
          .then(function(encryptedSymmetricKeyAndIVArray) {
            state.encryptedSymmetricKeyAndIV = new Uint8Array(encryptedSymmetricKeyAndIVArray);
            // create output package from: [ [plaintext+((optional)digitalsignature+verifykey)+(optionally)publickey] + [symK+symIV] ]
            state.packedCipher = app.utils.packUint8Arrays(
              state.encryptedPlaintextAndDigitalSignatureAndVerifyKey,
              state.encryptedSymmetricKeyAndIV
            );
            resolve(state);
          })
          .catch(function(err) {
            // if rejected in any point of the process, report the error
            reject(err);
          });
        });
      },

      decryptAndVerify: function(asymAlg, symAlg, signingAlg, digestAlg, packedCipher, decryptionKey) {
        return new Promise(function(resolve, reject) {
          var state = {
            signed: false
          };

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
            state.hasSignature = plaintextAndDigitalSignatureAndVerifyKey[0][0];
            state.hasPublicKey = plaintextAndDigitalSignatureAndVerifyKey[0][1];
            state.plaintextUint8Array = plaintextAndDigitalSignatureAndVerifyKey[1];
            if (state.hasSignature) {
              // Is digitally signed
              state.signed = true;
              state.digitalSignature = plaintextAndDigitalSignatureAndVerifyKey[2];
              state.verifyKeyData = plaintextAndDigitalSignatureAndVerifyKey[3];
              state.publicKeyData = state.hasPublicKey?plaintextAndDigitalSignatureAndVerifyKey[4]:undefined;
              return module.digest(digestAlg, state.verifyKeyData);
            } else {
              // Not digitally signed
              state.publicKeyData = state.hasPublicKey?plaintextAndDigitalSignatureAndVerifyKey[2]:undefined;
              return module.returnResolve();
            }
          })
          .then(function(hash) {
            if (state.signed) {
              state.verifyKeyFingerprint = new Uint8Array(hash);
              return module.importKey(state.verifyKeyData, signingAlg, 'spki', true, ['verify']);
            } else {
              return module.returnResolve();
            }
          })
          .then(function(result) {
            if (state.signed) {
              state.verifyKey = result;
            }
            if (state.publicKeyData) {
              return module.importKey(state.publicKeyData, asymAlg, 'spki', true, ['encrypt']);
            } else {
              return module.returnResolve();
            }
          })
          .then(function(publicKey) {
            state.publicKey = publicKey;
            if (state.publicKeyData) {
              return module.digest(digestAlg, state.publicKeyData);
            } else {
              return module.returnResolve();
            }
          })
          .then(function(hash) {
            if (state.publicKeyData) {
              state.publicKeyFingerprint = new Uint8Array(hash);
            }
            if (state.signed) {
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


