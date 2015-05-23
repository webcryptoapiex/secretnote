// Copyright 2015 Mika "Fincodr" Luoma-aho
// Provided under the MIT license. See LICENSE file for details.
(function(parent){
  "use strict";

  // The main application module
  var app = parent.app = parent.app || {};

  var API_PATH = '/api';
  var API_VERSION = '/v1';

  function notSupported() {
    // not supported
    return new Promise(function(resolve, reject){ reject(); });
  }

  // BackendRemote Class
  app.BackendRemote = function(url, dbName) {
    this.dbName = dbName;
    this.address = url + API_PATH + API_VERSION + '/' + dbName;
  };

  // Not supported for remote backend
  app.BackendRemote.prototype.delete = function() { return notSupported(); };
  app.BackendRemote.prototype.getAllDataByIndex = function(index, key) { return notSupported(); };
  app.BackendRemote.prototype.getFirstByIndex = function(index, data) { return notSupported(); };
  app.BackendRemote.prototype.deleteFirst = function(data) { return notSupported(); };
  app.BackendRemote.prototype.getAllByIndex = function(index) { return notSupported(); };
  app.BackendRemote.prototype.updateData = function(data) { return notSupported(); };
  app.BackendRemote.prototype.clear = function() { return notSupported(); };
  app.BackendRemote.prototype.close = function() { return notSupported(); };
  app.BackendRemote.prototype.open = function() {
    // not needed with local backend
    return new Promise(function(resolve, reject){ resolve(); });
  };

  app.BackendRemote.prototype.getAllData = function(fingerprint) {
    var self = this;
    // get all data
    return new Promise(function(resolve, reject){
      $.getJSON(self.address + '/' + app.utils.convertUint8ArrayToHex(fingerprint), function(results){
        var data = [];
        _.forEach(results, function(result) {
          data.push({
            created: result.created_at,
            expires: result.expires_at,
            publicKeyFingerprint: result.fingerprint,
            id: app.utils.convertHexToUint8Array(result.hash),
            data: result.data[0]
          });
        });
        resolve(data);
      }).fail(function(jqXHR, textStatus, errorThrown) {
        reject('getJSON request failed! ' + textStatus);
      });
    });
  };

  app.BackendRemote.prototype.saveData = function(data) {
    var self = this;
    // append data
    var postData = {
      /* var note = new Note({
            created_at: now.toDate(),
            expires_at: new Moment(now).add(NOTE_KEEPTIME_IN_HOURS, 'hours').toDate(),
            fingerprint: postData.fingerprint,
            data: data
          })*/
      fingerprint: app.utils.convertUint8ArrayToHex(data.publicKeyFingerprint),
      data: data.data
    };
    return new Promise(function(resolve, reject){
      $.ajax({
          type: "POST",
          url: self.address,
          data: JSON.stringify(postData),
          contentType: "application/json; charset=utf-8",
          dataType: "json",
          success: function(data)
          {
            resolve();
          },
          failure: function(errMsg) {
            reject(errMsg);
          }
      });
    });
  };

})(this); // this = window


