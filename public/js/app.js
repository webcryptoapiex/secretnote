// Copyright 2015 Mika "Fincodr" Luoma-aho
// Provided under the MIT license. See LICENSE file for details.
(function(parent){
  "use strict";

  // Wait until DOM is loaded
  $(document).ready(function() {

    // The main application module
    var app = parent.app = parent.app || {};

    // aliases
    var utils = app.utils;
    var debug = app.debug;
    var cryptography = app.cryptography;
    var keyStorage = new app.BackendLocal('PrivateKeys', 'store', ['name', 'publicKeyFingerprint', 'verifyKeyFingerprint'], 'name');
    var noteStorage;
    if (app.config.useServerBackend) {
      noteStorage = new app.BackendRemote(app.config.remoteAddress, 'notes');
    } else {
      noteStorage = new app.BackendLocal('PrivateNotes', 'store', ['publicKeyFingerprint', 'created', 'id'], 'created');
    }

    // test data
    var Message = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

    var SNPG_PRV_HEADER = '-- BEGIN SECRETNOTE PRIVATE KEY BLOCK --\n-- Ver: SNPG v1.0.0.0 --\n';
    var SNPG_PRV_FOOTER = '-- END SECRETNOTE PRIVATE KEY BLOCK --';
    var SNPG_PUB_HEADER = '-- BEGIN SECRETNOTE PUBLIC KEY BLOCK --\n-- Ver: SNPG v1.0.0.0 --\n';
    var SNPG_PUB_FOOTER = '-- END SECRETNOTE PUBLIC KEY BLOCK --';

    // global algorithm settings
    var symmetricAlgorithm = {
      name: "AES-CBC",
      length: 128
    };

    var asymmetricAlgorithm = {
      name: "RSA-OAEP",
      modulusLength: 2048, // 1024, 2048, 4096
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: {
        name: "SHA-256" // "SHA-1", "SHA-256", "SHA-384", "SHA-512"
      }
    };

    var signingAlgorithm = {
      name: "RSASSA-PKCS1-v1_5", // RSA-PSS (not supported in linux chrome)
      modulusLength: 2048, // 1024, 2048, 4096
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: {
        name: "SHA-256" // "SHA-1", "SHA-256", "SHA-384", "SHA-512"
      },
      //saltLength: 128, //the length of the salt (only for RSA-PSS)
    };

    var digestAlgorithm = {
      name: "SHA-1",
    };

    app = (function(){

      // define module
      var module = {
        identitiesCount: 0,
        activeIdentity: null,
        activeNote: null,
        activeData: null,

        init: function() {
          // TODO: Check for required features
          // 1. Promises (ES6)
          // 2. IndexedDB
          // 3. Crypto and SubtleCrypto
          //
          // Open keyStorage database
          keyStorage.open().then(function(db){
            // Open noteStorage database
            noteStorage.open().then(function(db){
              module.startApp();
            }).catch(function(err){
              debug.error(err);
            });
          }).catch(function(err){
            debug.error(err);
          });
        },

        setActiveData: function(data) {
          module.activeData = data;
        },

        setTargetIdentity: function(obj) {
          module.targetIdentity = obj;
        },

        setActiveIdentity: function(obj) {
          module.setTargetIdentity(obj);
          module.activeIdentity = obj;
          module.refreshNotes();
          if (obj) {
            module.decrypt();
          }
          if (module.identitiesCount!==0) {
            // Check if we have any identity selected
            if (module.activeIdentity) {
              $('#notifySelectIdentity').addClass('hidden');
              $('#notesSection').removeClass('hidden');
            } else {
              $('#notifySelectIdentity').removeClass('hidden');
              $('#notesSection').addClass('hidden');
            }
          } else {
            $('#notifySelectIdentity').addClass('hidden');
            $('#notesSection').removeClass('hidden');
          }
        },

        setActiveNote: function(obj) {
          return new Promise(function(resolve, reject) {
            module.activeNote = obj;
            if (obj) {
              $('#input').val(obj.data);
              module.decrypt().then(function(result){
                module.activeNote.result = result;
                var output = $('#output').val();
                $('#outputNote').val(output);
                resolve(result);
              });
            } else {
              reject();
            }
          });
        },

        saveNote: function() {
          return new Promise(function(resolve, reject) {
            // Save note to noteStorage
            var $note = $('#output');
            var data = $note.val();
            // Save one note to noteStorage
            var now = moment();
            var expires = moment(now).add(1, 'days');
            var noteId = new Uint8Array(20);
            window.crypto.getRandomValues(noteId);
            noteStorage.saveData({
              created: now.toISOString(),
              expires: expires.toISOString(),
              publicKeyFingerprint: module.targetIdentity.publicKeyFingerprint,
              id: noteId,
              data: data
            }).then(function(){
              module.refreshNotes();
              resolve();
            }).catch(function(err){
              console.log(err);
              reject(err);
            });
          });
        },

        refreshNotes: function() {
          // Update notes view (notes for active identity)
          var $notes = $('#notesTableBody');
          var $notesFooter = $('#notesTableFooter');
          // Update debug view (all notes)
          var $debugNotes = $('#debugNotes');
          var notesCount = 0;
          var now = moment();
          if (module.activeIdentity) {
            noteStorage.getAllData(module.activeIdentity.publicKeyFingerprint).then(function(data){
              $debugNotes.empty();
              $notes.empty();
              _.forEach(data, function(obj){
                if (utils.compareTwoUint8Arrays(module.activeIdentity.publicKeyFingerprint, obj.publicKeyFingerprint)) {
                  notesCount++;
                  var created = moment(obj.created);
                  var expires = moment(obj.expires);
                  var diff = expires.diff(now, 'hours');
                  var $el = $('<tr class="clickable-row">' +
                    '<td>' + created.toISOString() + '</td>' +
                    '<td>in ' + diff + ' hour(s)</td>' +
                    '<td class="id"><a href="#' + utils.convertUint8ArrayToHex(obj.id) + '">'  + utils.convertUint8ArrayToHex(obj.id, ':') + '</a></td>' +
                    //'<td><span class="label label-danger">not signed</span></td>' +
                  '</tr>');
                  $notes.append($el);
                  $el.click(function(){
                    // set active
                    $notes.find('tr').removeClass('info');
                    //$el.addClass('info');
                    module.openDecryptModal(obj);
                  });
                }
              });
              $notesFooter.empty();
              $notesFooter.html('Total of ' + notesCount + ' note(s)');
              _.forEach(data, function(obj){
                // Append debug
                var $el = $('<a href="#" class="list-group-item">' +
                    'ID: <div class="list-group-item-pre">' + utils.convertUint8ArrayToHex(obj.id, ':') + '</div>' +
                    'PublicKey fingerprint: <div class="list-group-item-pre">' + utils.convertUint8ArrayToHex(obj.publicKeyFingerprint, ':') + '</div>' +
                    'Created: <div class="list-group-item-pre">' + obj.created + '</div>' +
                    'Expires: <div class="list-group-item-pre">' + obj.expires + '</div>' +
                  '</a>');
                $debugNotes.append($el);
                $el.click(function(){
                  // set active
                  $debugNotes.find('a').removeClass('active');
                  $el.addClass('active');
                  module.setActiveNote(obj);
                });
              });
            }).catch(function(err){
              console.log(err);
            });
          }
        },

        openDecryptModal: function(obj) {
          module.setActiveNote(obj)
          .then(function(result){
            // find identity and match fingerprint
            module.setTargetIdentity(null);
            if (result.hasPublicKey) {
              _.forEach(module.identities, function(test) {
                if (utils.compareTwoUint8Arrays(test.publicKeyFingerprint, result.publicKeyFingerprint)) {
                  module.setTargetIdentity(test);
                  return false;
                }
              });
            }
            // reset all to hidden
            $('#modalDecryptNoDigitalSignature').removeClass('show').addClass('hide');
            $('#modalDecryptDigitalSignatureInvalid').removeClass('show').addClass('hide');
            $('#modalDecryptDigitalSignatureValidButNotTrusted').removeClass('show').addClass('hide');
            $('#modalDecryptDigitalSignatureValid').removeClass('show').addClass('hide');
            $('#modalDecryptSenderNotKnown').removeClass('show').addClass('hide');
            $('#modalDecryptSenderNotTrusted').removeClass('show').addClass('hide');
            $('#modalDecryptSenderTrusted').removeClass('show').addClass('hide');

            $('#modalDecryptSenderFingerprint').html('(anonymous sender)');
            $('#modalDecryptSignerFingerprint').html('(no digital signature)');

            // if sender is known
            if (module.targetIdentity) {

              // if sender is trusted
              if (module.targetIdentity.trusted) {
                $('#modalDecryptSenderTrusted').addClass('show');
                $('#modalDecryptSenderName').addClass('label-success').removeClass('label-warning').removeClass('label-danger');
              } else {
                $('#modalDecryptSenderNotTrusted').addClass('show');
                $('#modalDecryptSenderName').addClass('label-warning').removeClass('label-danger').removeClass('label-danger');
              }

              // show sender nick
              $('#modalDecryptSenderName').html(module.targetIdentity.name);

              // show fingerprints
              $('#modalDecryptSenderFingerprint').html(utils.convertUint8ArrayToHex(result.publicKeyFingerprint, ':'));
              if (result.hasSignature) {
                $('#modalDecryptSignerFingerprint').html(utils.convertUint8ArrayToHex(result.verifyKeyFingerprint, ':'));
              }

              // update modal infos
              var digitalSignatureKeyKnown = false;
              if (result.hasSignature && module.targetIdentity.verifyKeyFingerprint) {
                digitalSignatureKeyKnown = utils.compareTwoUint8Arrays(module.targetIdentity.verifyKeyFingerprint, result.verifyKeyFingerprint);
              }

              if (result.hasSignature) {
                if (result.digitalSignatureValid && digitalSignatureKeyKnown) {
                  // signature and key is ok
                  $('#modalDecryptDigitalSignatureValid').removeClass('hide').addClass('show');
                } else if (result.digitalSignatureValid && !digitalSignatureKeyKnown) {
                  // signature ok, but key is not current
                  $('#modalDecryptDigitalSignatureValidButNotTrusted').removeClass('hide').addClass('show');
                } else {
                  // signature not ok
                  $('#modalDecryptDigitalSignatureInvalid').removeClass('hide').addClass('show');
                }
              } else {
                // signature missing
                $('#modalDecryptNoDigitalSignature').removeClass('hide').addClass('show');
              }
            } else {
              if (result.hasPublicKey) {
                // sender is not known
                $('#modalDecryptSenderName').html('UNKNOWN');
                $('#modalDecryptSenderName').addClass('label-warning').removeClass('label-success').removeClass('label-danger');
                $('#modalDecryptSenderNotKnown').addClass('show').removeClass('hide');
                // show fingerprints
                $('#modalDecryptSenderFingerprint').html(utils.convertUint8ArrayToHex(result.publicKeyFingerprint, ':'));
                if (result.hasSignature) {
                  $('#modalDecryptSignerFingerprint').html(utils.convertUint8ArrayToHex(result.verifyKeyFingerprint, ':'));
                }
              } else {
                // sender is anonymous
                $('#modalDecryptSenderName').html('ANONYMOUS');
                $('#modalDecryptSenderName').addClass('label-danger').removeClass('label-success').removeClass('label-warning');
              }
            }

            // show modal
            $('#modalDecryptNote').modal('show');
          });
        },

        refreshIdentities: function() {
          // Load keyStorage information
          return new Promise(function(done, fail) {
            module.identitiesCount = 0;
            module.identities = [];
            var $debugIdentities = $('#debugIdentities');
            var $privateIdentities = $('#privateKeysTableBody');
            var $publicIdentities = $('#publicKeysTableBody');
            keyStorage.getAllData().then(function(data) {
              $debugIdentities.empty();
              $privateIdentities.empty();
              $publicIdentities.empty();
              module.identitiesCount = data.length;
              if (module.identitiesCount!==0) {
                _.forEach(data, function(obj){
                  module.identities.push(obj);
                  var isPrivateIdentity = false;
                  var usages = [];
                  if (obj.publicKey) {
                    usages = _.union(usages, obj.publicKey.usages);
                  }
                  if (obj.privateKey) {
                    usages = _.union(usages, obj.privateKey.usages);
                    isPrivateIdentity = true;
                  }
                  if (obj.signingKey) {
                    usages = _.union(usages, obj.signingKey.usages);
                    isPrivateIdentity = true;
                  }
                  if (obj.verifyKey) {
                    usages = _.union(usages, obj.verifyKey.usages);
                  }
                  var usageLabels = '';
                  var types = {
                    'encrypt': 'success',
                    'decrypt': 'danger',
                    'sign': 'info',
                    'verify': 'info'
                  };
                  _.forEach(usages, function(usage){
                    var type = types[usage] || 'default';
                    usageLabels += ' <span class="label label-' + type + '">' + usage + '</span>';
                  });

                  var publicKeyFingerprint = _.has(obj, 'publicKeyFingerprint')?obj.publicKeyFingerprint:undefined;
                  var verifyKeyFingerprint = _.has(obj, 'verifyKeyFingerprint')?obj.verifyKeyFingerprint:undefined;
                  var publicKeyFingerprintHex = publicKeyFingerprint?utils.convertUint8ArrayToHex(publicKeyFingerprint, ':'):'(no public key)';
                  var verifyKeyFingerprintHex = verifyKeyFingerprint?utils.convertUint8ArrayToHex(verifyKeyFingerprint, ':'):'(no verify key)';

                  // append identities (private and public)
                  var $el1 = $('<tr class="clickable-row">' +
                    '<td>' + obj.name + '</td>' +
                    '<td class="id">' +
                      publicKeyFingerprintHex + '<br />' +
                      verifyKeyFingerprintHex +
                    '</td>' +
                    '<td>' + usageLabels + '</td>' +
                    '<td class="pull-center"><a data-action="delete" href="#"><i class="glyphicon glyphicon-trash"></i></a>' +
                    '&nbsp; &nbsp; <a data-action="export" href="#"><i class="glyphicon glyphicon-save"></i></a></td>' +
                  '</tr>');
                  if (isPrivateIdentity) {
                    $privateIdentities.append($el1);
                    $el1.click(function(e){
                      if ($(e.target).parent().data('action') == 'delete') {
                        // delete
                        keyStorage.deleteFirst(obj.name).then(function(){
                          module.refreshIdentities();
                        });
                        e.preventDefault();
                      } else if ($(e.target).parent().data('action') == 'export') {
                        // export
                        module.setActiveIdentity(obj);
                        module.exportIdentity();
                        e.preventDefault();
                      } else {
                        // set active
                        $privateIdentities.find('tr').removeClass('info');
                        $el1.addClass('info');
                        module.setActiveIdentity(obj);
                        $('#navbar a[href="#notes"]').tab('show');
                      }
                    });
                  } else {
                    $publicIdentities.append($el1);
                    $el1.click(function(e){
                      if ($(e.target).parent().data('action') == 'delete') {
                        // delete
                        keyStorage.deleteFirst(obj.name).then(function(){
                          module.refreshIdentities();
                        });
                        e.preventDefault();
                      } else if ($(e.target).parent().data('action') == 'export') {
                        // export
                        module.setActiveIdentity(obj);
                        module.exportIdentity();
                        e.preventDefault();
                      } else {
                        e.preventDefault();
                      }
                    });
                  }
                  // append debug
                  var $el2 = $('<a href="#" class="list-group-item">' +
                    '<h4 class="list-group-item-heading">' + obj.name + '</h4>' + usageLabels +
                    '<div class="list-group-item-pre">' + publicKeyFingerprintHex + '</div>' +
                    '<div class="list-group-item-pre">' + verifyKeyFingerprintHex + '</div>' +
                  '</a>');
                  $debugIdentities.append($el2);
                  $el2.click(function(){
                    // set active
                    $debugIdentities.find('a').removeClass('active');
                    $el2.addClass('active');
                    module.setActiveIdentity(obj);
                  });
                });
              } else {
                $('#notifyCreateIdentity').removeClass('hidden');
              }
              done();
            }).catch(function(err){
              console.log(err);
              fail(err);
            });
          });
        },

        startApp: function() {

          // Set states
          $('#checkboxAnonymous').prop('checked', true);
          $('#checkboxDigitallySign').prop('checked', true);
          $('#createNoteSignDigitally').removeClass('show').addClass('hide');

          // Attach handlers
          $('#btnClearDebug').click(function(){
            debug.clear();
          });

          $('#btnClearInput,#btnClearOutput').click(function(){
            $(this).closest('.panel').find('textarea').eq(0).val('');
          });

          $('#btnDefaultInput').click(function(){
            $(this).closest('.panel').find('textarea').eq(0).val(Message);
          });

          $('#btnClearKeys').click(function(){
            keyStorage.clear().then(function(){
              module.refreshIdentities();
            });
          });

          $('#btnClearNotes').click(function(){
            noteStorage.clear().then(function(){
              module.refreshNotes();
            });
          });

          $('#btnRemoveKey').click(function(){
            keyStorage.deleteFirst(module.activeIdentity.name).then(function(){
              module.refreshIdentities();
            });
          });

          $('#btnRemoveNote').click(function(){
            noteStorage.deleteFirst(module.activeNote.created).then(function(){
              module.refreshNotes();
            });
          });

          $('#checkboxAnonymous').click(function(){
            // check if the item is checked
            var digitallySign = $('#checkboxAnonymous').is(":checked");
            if (digitallySign) {
              $('#createNoteSignDigitally').removeClass('show').addClass('hide');
            } else {
              // show digital signature option if available
              if (module.activeIdentity.signingKey && module.activeIdentity.verifyKey) {
                $('#createNoteSignDigitally').removeClass('hide').addClass('show');
              } else {
                $('#createNoteSignDigitally').removeClass('show').addClass('hide');
              }
            }
          });

          $('#btnSwapOutputWithInput').click(function(){
            var input = $('#input').val();
            var output = $('#output').val();
            $('#input').val(output);
            $('#output').val(input);
          });

          $('#btnSelectKeys').click(function(){
            $('#navbar a[href="#identities"]').tab('show');
          });

          $('#btnSaveOutput').click(function(){
            module.saveNote();
          });

          $('#btnDigest').click(function(){
            module.digest();
          });

          $('#btnSign').click(function(){
            module.sign();
          });
          $('#btnVerify').click(function(){
            module.verify();
          });

          $('#btnDecryptAddToKnownSenders').click(function() {
            // set the current modal as pending
            module.pendingNoteModal = true;
            // hide the modal
            $('#modalDecryptNote').modal('hide');
            // export the key
            var identity = {
              publicKey: module.activeNote.result.publicKey,
              verifyKey: module.activeNote.result.verifyKey,
              privateKey: undefined,
              signingKey: undefined
            };
            cryptography.exportIdentity(
              module.activeNote.result.publicKey,
              null,
              null,
              module.activeNote.result.verifyKey
            )
            .then(function(exported) {
              // convert result to base64
              var publicIdentityB64 = SNPG_PUB_HEADER +
                utils.convertUint8ArrayToBase64(exported.publicIdentityData) +
                '\n' + SNPG_PUB_FOOTER;
              var privateIdentityB64 = SNPG_PRV_HEADER +
                utils.convertUint8ArrayToBase64(exported.privateIdentityData) +
                '\n' + SNPG_PRV_FOOTER + '\n';
              // populate modal
              var identityB64 = '';
              if (exported.publicIdentityData.length>4) {
                // we have public identity
                identityB64 = publicIdentityB64;
              }
              if (exported.privateIdentityData.length>4) {
                // we have public identity
                if (identityB64.length!==0) {
                  identityB64 += '\n\n';
                }
                identityB64 += privateIdentityB64;
              }
              // fill-in the import key
              $('#importIdentityData').val(identityB64);
              // open the import modal
              $('#modalImportIdentity').modal('show');
            });
          });

          $('#btnDecryptTrustSender').click(function(){
            if (module.targetIdentity) {
              var identity = module.targetIdentity;
              // make this sender as trusted
              module.targetIdentity.trusted = true;
              // save changes to database
              keyStorage.updateData(identity).then(function(){
              }).then(function(){
                // reopen the modal
                module.openDecryptModal(module.activeNote);
              });
            }
          });

          $('#btnDecryptRevokeTrustSender').click(function(){
            if (module.targetIdentity) {
              var identity = module.targetIdentity;
              // make this sender as trusted
              module.targetIdentity.trusted = false;
              // save changes to database
              keyStorage.updateData(identity).then(function(){
              }).then(function(){
                // reopen the modal
                module.openDecryptModal(module.activeNote);
              });
            }
          });

          $('#btnDecryptTrustSigningKey').click(function(){
            if (module.targetIdentity) {
              var identity = module.targetIdentity;
              // make verifyKey as current
              identity.verifyKey = module.activeData.verifyKey;
              identity.verifyKeyFingerprint = module.activeData.verifyKeyFingerprint;
              // save changes to database
              keyStorage.updateData(identity).then(function(){
              }).then(function(){
                // save current identity
                var curIdentity = module.activeIdentity;
                // refresh the identities list
                module.refreshIdentities().then(function(){
                  module.activeIdentity = curIdentity;
                  // reopen the modal
                  module.openDecryptModal(module.activeNote);
                });
              });
            }
          });

          $('#btnExportIdentity').click(function(){
            module.exportIdentity();
          });

          $('#btnCreateNote').click(function(){
            // populate recipient listing
            var $list = $('#selectRecipientList');
            $list.empty();
            _.forEach(module.identities, function(obj) {
              // skip our own identity
              if (!utils.compareTwoUint8Arrays(module.activeIdentity.publicKeyFingerprint, obj.publicKeyFingerprint)) {
                var $el = $('<option value="' + utils.convertUint8ArrayToHex(obj.publicKeyFingerprint, '') + '" data-subtext="' + utils.convertUint8ArrayToHex(obj.publicKeyFingerprint, ':') + '">' + obj.name + '</option>');
                $list.append($el);
              }
            });
            $list.selectpicker('render');
            $list.selectpicker('refresh');
            /*
            // show digital signature option if available
            if (module.activeIdentity.signingKey && module.activeIdentity.verifyKey) {
              $('#createNoteSignDigitally').removeClass('hide').addClass('show');
            } else {
              $('#createNoteSignDigitally').removeClass('show').addClass('hide');
            }
            */
            // show modal
            $('#modalCreateNote').modal('show');
          });

          $('#btnCreateNoteCancel').click(function(){
            // hide modal
            $('#modalCreateNote').modal('hide');
            $('#inputNote').val('');
            $('#checkboxAnonymous').prop('checked', true);
            $('#checkboxDigitallySign').prop('checked', true);
            $('#createNoteSignDigitally').removeClass('show').addClass('hide');
          });

          $('#btnCreateNoteSave').click(function(){
            var anonymous = $('#checkboxAnonymous').is(":checked");
            var includePublicKey = anonymous?false:true;
            var digitallySign;
            if (anonymous) {
              digitallySign = false;
            } else {
              digitallySign = $('#checkboxDigitallySign').is(":checked");
            }
            var targetFingerprint = $('#selectRecipientList').val();
            _.forEach(module.identities, function(obj) {
              var fingerprint = utils.convertUint8ArrayToHex(obj.publicKeyFingerprint, '');
              if (fingerprint === targetFingerprint) {
                module.setTargetIdentity(obj);
                return true;
              }
            });
            var plaintext = $('#inputNote').val();
            $('#input').val(plaintext);
            module.encrypt(digitallySign, includePublicKey)
            .then(function() {
              return module.saveNote();
            })
            .then(function() {
              // hide modal
              $('#modalCreateNote').modal('hide');
              $('#inputNote').val('');
              $('#checkboxAnonymous').prop('checked', true);
              $('#checkboxDigitallySign').prop('checked', true);
              $('#createNoteSignDigitally').removeClass('show').addClass('hide');
            });
          });

          $('#btnImportIdentitySave').click(function(){
            var name = $('#importIdentityName').val();
            var exportable = $('#checkboxImportExportable').is(":checked");
            var data = $('#importIdentityData').val();
            if (name.length!==0) {
              var identity = {
                name: name,
                trusted: true,
                local: true
              };
              // find identity blocks
              var publicIdentityB64 = '';
              var privateIdentityB64 = '';
              var s1 = data.indexOf(SNPG_PRV_HEADER);
              var s2 = data.indexOf(SNPG_PRV_FOOTER, s1);
              if (s1!==-1 && s2!==-1) {
                s1 += SNPG_PRV_HEADER.length;
                privateIdentityB64 = data.substr(s1, s2-s1);
              }
              s1 = data.indexOf(SNPG_PUB_HEADER);
              s2 = data.indexOf(SNPG_PUB_FOOTER, s1);
              if (s1!==-1 && s2!==-1) {
                s1 += SNPG_PUB_HEADER.length;
                publicIdentityB64 = data.substr(s1, s2-s1);
              }
              var publicIdentityData = utils.convertBase64ToUint8Array(publicIdentityB64);
              var privateIdentityData = utils.convertBase64ToUint8Array(privateIdentityB64);

              cryptography.importIdentity(asymmetricAlgorithm, signingAlgorithm, publicIdentityData, privateIdentityData, exportable)
              .then(function(result) {
                identity.publicKey = result.publicKey;
                identity.privateKey = result.privateKey;
                identity.signingKey = result.signingKey;
                identity.verifyKey = result.verifyKey;
                return cryptography.exportKey(identity.publicKey, 'spki');
              })
              .then(function(result) {
                return window.crypto.subtle.digest({ name: "SHA-1" }, result);
              })
              .then(function(hash) {
                identity.publicKeyFingerprint = new Uint8Array(hash);
                if (identity.verifyKey) {
                  return cryptography.exportKey(identity.verifyKey, 'spki');
                } else {
                  return cryptography.returnResolve();
                }
              })
              .then(function(result) {
                if (result) {
                  return window.crypto.subtle.digest({ name: "SHA-1" }, result);
                } else {
                  return cryptography.returnResolve();
                }
              })
              .then(function(hash) {
                if (hash) {
                  identity.verifyKeyFingerprint = new Uint8Array(hash);
                }
                // Save one key to keyStorage
                keyStorage.saveData(identity).then(function(){
                  module.refreshIdentities().then(function(){
                    $('#modalImportIdentity').modal('hide');
                    $('#importIdentityName').val('');
                    $('#importIdentityData').val('');
                    $('#checkboxImportExportable').attr('checked', false);
                    // check if we have pending modals
                    if (module.pendingNoteModal) {
                      // reopen the modal
                      module.pendingNoteModal = false;
                      module.openDecryptModal(module.activeNote);
                    }
                  });
                }).catch(function(e){
                  debug.error('<b>Digest on publicKey failed!</b> ' + e.message);
                });
              })
              .catch(function(err) {
                debug.error('<b>Error while importing identity</b><br />Code:' + err.code + '<br />Message:' + err.message);
                alert('Error while importing the identity. Please check the input and try again!');
              });
            }
          });

          $('#btnGenerateIdentitySave').click(function(){
            var name = $('#inputName').val();
            var exportable = $('#checkboxExportable').is(":checked");
            if (name.length!==0) {
              var identity = {
                name: name,
                trusted: true,
                local: true
              };
              cryptography.generateKeys(asymmetricAlgorithm, exportable, ['encrypt', 'decrypt'])
              .then(function(result) {
                identity.publicKey = result.publicKey;
                identity.privateKey = result.privateKey;
                return cryptography.exportKey(identity.publicKey, 'spki');
              })
              .then(function(result) {
                return window.crypto.subtle.digest({ name: "SHA-1" }, result);
              })
              .then(function(hash) {
                identity.publicKeyFingerprint = new Uint8Array(hash);
                return cryptography.generateKeys(signingAlgorithm, exportable, ['sign', 'verify']);
              })
              .then(function(result) {
                identity.signingKey = result.privateKey;
                identity.verifyKey = result.publicKey;
                return cryptography.exportKey(identity.verifyKey, 'spki');
              })
              .then(function(result) {
                return window.crypto.subtle.digest({ name: "SHA-1" }, result);
              })
              .then(function(hash) {
                identity.verifyKeyFingerprint = new Uint8Array(hash);
                // Save one key to keyStorage
                keyStorage.saveData(identity).then(function(){
                  module.refreshIdentities();
                  $('#modalGenerateIdentity').modal('hide');
                  $('#inputName').val('');
                  $('#checkboxExportable').attr('checked', false);
                }).catch(function(e){
                  debug.error('<b>Digest on publicKey failed!</b> ' + e.message);
                });
              })
              .catch(function(err) {
                debug.error('<b>Error while generating identity</b><br />Code:' + e.code + '<br />Message:' + e.message);
              });
            }
          });

          $('#btnEncrypt').click(function(){
            module.encrypt();
          });
          $('#btnDecrypt').click(function(){
            module.decrypt();
          });

          $('#btnExportKey').click(function(){
            module.exportKey();
          });
          $('#btnImportPrivateKey').click(function(){
            module.importPrivateKey();
          });

          // Attach debug to debug div element
          debug.attach(document.getElementById('console'));

          // Check Web Cryptography API support
          if (cryptography.isSupported()) {
            debug.info('Web Cryptography API is supported');
            module.refreshIdentities().then(function(){
              module.setActiveIdentity();
              module.refreshNotes();
              setInterval(function(){
                module.refreshNotes();
              }, 1000*30);
            });
          } else {
            debug.error('Web Cryptography API is NOT supported!');
            alert('This example application requires support for Web Cryptography API!');
          }
        },

        sign: function() {
          var data = $('#input').val();
          try {
            var promise = window.crypto.subtle.sign(
              signingAlgorithm,
              module.activeIdentity.signingKey,
              utils.convertTextToUint8Array(data)
            ).then(
              function(signedData){
                var data2 = new Uint8Array(signedData);
                debug.info('<b>Signed:</b><br />' + utils.convertUint8ArrayToHexView(data2, 16, '\u00B7'));
                var base64 = utils.convertUint8ArrayToBase64(data2);
                $('#output').val(base64);
              },
              function(e){
                $('#output').val('');
                debug.error('<b>Sign failed!</b> ' + e.message);
              }
            )
            .catch(function(e){
              $('#output').val('');
              debug.error('<b>Sign failed!</b> ' + e.message);
            });
          } catch (e) {
            $('#output').val('');
            debug.error('<b>Sign failed!</b> ' + e.message);
          }
        },

        verify: function() {
          var data = $('#input').val();
          var encryptedDataFromBase64 = utils.convertBase64ToUint8Array(data);
          var signature = $('#output').val();
          var signatureFromBase64;
          if (_.endsWith(signature, '==')) {
            signatureFromBase64 = utils.convertBase64ToUint8Array(signature);
          } else {
            signatureFromBase64 = utils.convertTextToUint8Array(signature);
          }
          try {
            debug.info('<b>Verify</b><br/>Signature:<br/>' + utils.convertUint8ArrayToHexView(signatureFromBase64, 16, '\u00B7') + '<br/>Data:<br/>' + utils.convertUint8ArrayToHexView(encryptedDataFromBase64, 16, '\u00B7'));
            var promise = window.crypto.subtle.verify(
              signingAlgorithm,
              module.activeIdentity.verifyKey,
              encryptedDataFromBase64,
              signatureFromBase64
            )
            .then(function(result){
              if (result) {
                debug.log('<b>Signature verified OK!</b>');
              } else {
                debug.error('<b>Invalid signature/data!</b>');
              }
            })
            .catch(function(e){
              debug.error('<b>Verify failed!</b> Catched error: ' + e.message);
            });
          } catch (e) {
            debug.error('<b>Verify failed!</b> Exception: ' + e.message);
          }
        },

        encrypt: function(createSignature, includePublicKey) {
          return new Promise(function(resolve, reject) {
            var data = $('#input').val();
            cryptography.encryptAndSign(
              asymmetricAlgorithm, symmetricAlgorithm, signingAlgorithm,
              data,
              module.targetIdentity.publicKey, // used for encrypting the data
              createSignature?module.activeIdentity.signingKey:undefined, // used for signing the data
              createSignature?module.activeIdentity.verifyKey:undefined, // used for including senders verify key
              includePublicKey?module.activeIdentity.publicKey:undefined // used for including senders public key
            )
            .then(function(result){
              var data = new Uint8Array(result.packedCipher);
              debug.info('<b>Encrypted:</b><br />' + utils.convertUint8ArrayToHexView(data, 16, '\u00B7'));
              var base64 = utils.convertUint8ArrayToBase64(data);
              $('#output').val(base64);
              resolve();
            })
            .catch(function(e){
              $('#output').val('');
              debug.error('<b>Encrypt failed!</b> ' + e.message);
              reject(e);
            });
          });
        },

        decrypt: function() {
          return new Promise(function(resolve, reject) {
            var data = $('#input').val();
            if (module.activeIdentity && data.length>0) {
              var encryptedDataFromBase64 = utils.convertBase64ToUint8Array(data);
              cryptography.decryptAndVerify(
                asymmetricAlgorithm,
                symmetricAlgorithm,
                signingAlgorithm,
                digestAlgorithm,
                encryptedDataFromBase64,
                module.activeIdentity.privateKey)
              .then(function(result) {
                module.setActiveData(result);
                var plaintext = utils.convertUint8ArrayToText(result.plaintextUint8Array);
                if (result.signed) {
                  if (result.digitalSignatureValid) {
                    debug.log(
                      '<b>Decrypted (Digital Signature verified):</b><br />' + utils.convertUint8ArrayToHexView(result.plaintextUint8Array, 16, '\u00B7')
                    );
                  } else {
                    debug.warn(
                      '<b>Decrypted (Digital Signature not ok):</b><br />' + utils.convertUint8ArrayToHexView(result.plaintextUint8Array, 16, '\u00B7')
                    );
                  }
                } else {
                  debug.warn(
                    '<b>Decrypted (Digital Signature missing):</b><br />' + utils.convertUint8ArrayToHexView(result.plaintextUint8Array, 16, '\u00B7')
                  );
                }
                $('#output').val(plaintext);
                resolve(result);
              })
              .catch(function(e){
                $('#output').val('');
                debug.error('<b>Decrypt failed!</b> ' + e);
                reject(e.message);
              });
            } else {
              resolve(); //reject('No active identity or data');
            }
          });
        },

        importPrivateKey: function() {
          var strPub = $('#input').val();
          var strPrv = $('#output').val();
          var publicKey = null;
          var privateKey = null;
          function importPubKey() {
           return new Promise(function(resolve, reject){
              try {
                window.crypto.subtle.importKey(
                  "jwk",
                  JSON.parse(strPub),
                  asymmetricAlgorithm,
                  true, // exportable
                  ["encrypt"] // encrypt for publicKey import
                )
                .then(function(key){
                    //returns a publicKey (or privateKey if you are importing a private key)
                    publicKey = key;
                    resolve(true);
                },function(err){
                  console.error(err);
                  resolve(false);
                })
                .catch(function(err){
                    console.error(err);
                    resolve(false);
                });
              } catch (e) {
                resolve(false);
              }
            });
          }

          function importPrvKey() {
            return new Promise(function(resolve, reject){
              try {
                window.crypto.subtle.importKey(
                  "jwk",
                  JSON.parse(strPrv),
                  asymmetricAlgorithm,
                  false, // exportable
                  ["decrypt"] // decrypt for privateKey import
                )
                .then(function(key){
                    //returns a publicKey (or privateKey if you are importing a private key)
                    privateKey = key;
                    resolve(true);
                },function(err){
                  console.error(err);
                  resolve(false);
                })
                .catch(function(err){
                  console.error(err);
                  resolve(false);
                });
              } catch (e) {
                resolve(false);
              }
            });
          }

          Promise.all([importPubKey(), importPrvKey()]).then(function(){
            // export public key
            window.crypto.subtle.exportKey(
              'spki',
              publicKey
            )
            .then(function(exportedKey){
              var data = new Uint8Array(exportedKey);
              window.crypto.subtle.digest(
                digestAlgorithm,
                data
              )
              .then(function(hash) {
                var fingerprint = new Uint8Array(hash);
                debug.info('<b>Fingerprint:</b><br />' + utils.convertUint8ArrayToHexView(fingerprint, 16, '\u00B7'));
                // Save one key to keyStorage
                keyStorage.saveData({
                  name: 'Imported ' + new Date().toISOString(),
                  trusted: false,
                  publicKey: publicKey,
                  privateKey: privateKey,
                  publicKeyFingerprint: fingerprint
                }).then(function(){
                  module.refreshIdentities();
                }).catch(function(e){
                  debug.error('<b>keyStorage save failed</b> ' + e);
                });
              })
              .catch(function(e){
                debug.error('<b>Digest on publicKey failed!</b> ' + e);
              });
            }).catch(function(e){
              debug.error('<b>Export publicKey failed!</b> ' + e);
            });
          }).catch(function(e){
            debug.error('<b>Promise failed while importing public and private keys</b>');
          });
        },

        exportIdentity: function() {
          var identity = module.activeIdentity;
          cryptography.exportIdentity(identity.publicKey, identity.privateKey, identity.signingKey, identity.verifyKey)
          .then(function(exported) {
            // convert result to base64
            var publicIdentityB64 = SNPG_PUB_HEADER +
              utils.convertUint8ArrayToBase64(exported.publicIdentityData) +
              '\n' + SNPG_PUB_FOOTER;
            var privateIdentityB64 = SNPG_PRV_HEADER +
              utils.convertUint8ArrayToBase64(exported.privateIdentityData) +
              '\n' + SNPG_PRV_FOOTER + '\n';

            // populate modal
            var identityB64 = '';
            if (exported.publicIdentityData.length>4) {
              // we have public identity
              identityB64 = publicIdentityB64;
            }
            if (exported.privateIdentityData.length>4) {
              // we have public identity
              if (identityB64.length!==0) {
                identityB64 += '\n\n';
              }
              identityB64 += privateIdentityB64;
            }

            $('#modalExportIdentityName').text(identity.name);
            $('#modalExportIdentityKeyFingerprint').text(utils.convertUint8ArrayToHex(identity.publicKeyFingerprint, ':'));
            $('#modalExportIdentitySigningFingerprint').text(utils.convertUint8ArrayToHex(identity.verifyKeyFingerprint, ':'));

            $('#outputIdentity').val(
              identityB64
            );
            // show modal
            $('#modalExportIdentity').modal('show');
          })
          .catch(function(err) {
            // populate error modal
            // show error modal
            console.error(err);
          });
        },

        exportKey: function() {
          $('#input').val('');
          $('#output').val('');
          // export public key
          window.crypto.subtle.exportKey(
            'jwk',
            module.activeIdentity.publicKey
          )
          .then(function(exportedKey){
            $('#input').val(JSON.stringify(exportedKey));
          });
          // export private key
          window.crypto.subtle.exportKey(
            'jwk',
            module.activeIdentity.privateKey
          )
          .then(function(exportedKey){
            $('#output').val(JSON.stringify(exportedKey));
          });
        },

        digest: function() {
          var msg = $('#input').val();
          debug.log('<b>Plain text:</b><br />' + utils.convertUint8ArrayToHexView(utils.convertTextToUint8Array(msg), 10, '\u00B7'));
          try {
            window.crypto.subtle.digest(
              {
                name: "SHA-1",
              },
              new Uint8Array(utils.convertTextToUint8Array(msg)) //The data you want to hash as an ArrayBuffer
            )
            .then(function(hash) {
              var data = new Uint8Array(hash);
              debug.info('<b>Digest:</b><br />' + utils.convertUint8ArrayToHexView(data, 10, '\u00B7'));
              var base64 = utils.convertUint8ToBase64(data);
              $('#output').val(base64);
            })
            .catch(function(err){
              $('#output').val('');
              debug.error('<b>Digest failed!</b> ' + e.message);
            });
          } catch (e) {
            debug.error('<b>Digest failed!</b> ' + e.message);
          }
        }
      };

      return module;
    })();

    // init main
    app.init();

  });

})(this);
