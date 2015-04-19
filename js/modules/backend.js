// Copyright 2015 Mika "Fincodr" Luoma-aho
// Provided under the MIT license. See LICENSE file for details.
(function(parent){
  "use strict";

  // The main application module
  var app = parent.app = parent.app || {};

  // Support browser prefixes
  var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
  var IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
  var IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;

  // Backend Class
  app.Backend = function(databaseName, objectStoreName, indexes, keyPath) {
    this.dbHandle = undefined;
    this.dbName = databaseName;
    this.dbObjectStoreName = objectStoreName;
    this.dbIndexes = indexes;
    this.dbKeyPath = keyPath;
  };

  // Add methods
  app.Backend.prototype.delete = function() {
    var self = this;
    // delete the database
    return new Promise(function(resolve, reject){
      var request = indexedDB.deleteDatabase(self.dbName);
      request.onerror = function(event) {
        reject('Error: Database delete failed.');
      };
      request.onsuccess = function(event) {
        self.dbHandle = request.result;
        resolve(self.dbHandle);
      };
    });
  };

  app.Backend.prototype.open = function() {
    var self = this;
    // open the database
    return new Promise(function(resolve, reject){
      var request = indexedDB.open(self.dbName);
      request.onerror = function(event) {
        reject('Error: Database open failed.');
      };
      request.onsuccess = function(event) {
        console.log('Backend.onsuccess');
        self.dbHandle = request.result;
        resolve(self.dbHandle);
      };
      request.onupgradeneeded = function(event) {
        console.log('Backend.onupgradeneeded');
        self.dbHandle = request.result;
        if (!self.dbHandle.objectStoreNames.contains(self.dbObjectStoreName)) {
          var objectStore = self.dbHandle.createObjectStore(self.dbObjectStoreName, { autoIncrement: true, keyPath: self.dbKeyPath });
          for (var i=0; i!==self.dbIndexes.length; ++i) {
            var indexName = self.dbIndexes[i];
            objectStore.createIndex(indexName, indexName, {unique: false});
          }
        }
        return true;
      };
    });
  };

  app.Backend.prototype.getAllData = function() {
    var self = this;
    // get all data
    return new Promise(function(resolve, reject){
      if (!self.dbHandle) {
        reject('Error: No database open.');
      }
      var data = [];
      var transaction = self.dbHandle.transaction([self.dbObjectStoreName], "readonly");
      var objectStore = transaction.objectStore(self.dbObjectStoreName);
      var request = objectStore.openCursor();
      request.onsuccess = function(event) {
        var cursor = event.target.result;
        if (cursor) {
          data.push(cursor.value);
          cursor.continue();
        } else {
          resolve(data);
        }
      };
      request.onerror = function(event) {
        reject(event.target.error.message);
      };
    });
  };

  app.Backend.prototype.getAllDataByIndex = function(index, key) {
    var self = this;
    // get all data
    return new Promise(function(resolve, reject){
      if (!self.dbHandle) {
        reject('Error: No database open.');
      }
      var data = [];
      var transaction = self.dbHandle.transaction([self.dbObjectStoreName], "readonly");
      var objectStore = transaction.objectStore(self.dbObjectStoreName);
      var singleKeyRange;
      try {
        singleKeyRange = IDBKeyRange.only(new Array(key));
      } catch (e) {
        console.log('Exception:', e.toString());
      }
      var request = objectStore.index(index).openCursor(singleKeyRange);
      request.onsuccess = function(event) {
        var cursor = event.target.result;
        if (cursor) {
          data.push(cursor.value);
          cursor.continue();
        } else {
          resolve(data);
        }
      };
      request.onerror = function(event) {
        reject(event.target.error.message);
      };
    });
  };

  app.Backend.prototype.getFirstByIndex = function(index, data) {
    var self = this;
    // find (first) data from specified index
    return new Promise(function(resolve, reject){
      if (!self.dbHandle) {
        reject('Error: No database open.');
      }
      var transaction = self.dbHandle.transaction([self.dbObjectStoreName], "readonly");
      var objectStore = transaction.objectStore(self.dbObjectStoreName);
      var request = objectStore.index(index).get(data);
      request.onsuccess = function(event) {
        var data = event.target.result;
        resolve(data);
      };
      request.onerror = function(event) {
        reject(event.target.error.message);
      };
    });
  };

  app.Backend.prototype.deleteFirst = function(data) {
    var self = this;
    // find (first) data from specified index
    return new Promise(function(resolve, reject){
      if (!self.dbHandle) {
        reject('Error: No database open.');
      }
      var transaction = self.dbHandle.transaction([self.dbObjectStoreName], "readwrite");
      var objectStore = transaction.objectStore(self.dbObjectStoreName);
      var request = objectStore.delete(data);
      request.onsuccess = function(event) {
        var data = event.target.result;
        resolve(data);
      };
      request.onerror = function(event) {
        reject(event.target.error.message);
      };
    });
  };

  app.Backend.prototype.getAllByIndex = function(index) {
    var self = this;
    // find (first) data from specified index
    return new Promise(function(resolve, reject){
      if (!self.dbHandle) {
        reject('Error: No database open.');
      }
      var data = [];
      var transaction = self.dbHandle.transaction([self.dbObjectStoreName], "readonly");
      var objectStore = transaction.objectStore(self.dbObjectStoreName);
      var request = objectStore.index(index).openCursor();
      request.onsuccess = function(event) {
        var cursor = event.target.result;
        if (cursor) {
          data.push(cursor.value);
          cursor.continue();
        } else {
          resolve(data);
        }
      };
      request.onerror = function(event) {
        reject(event.target.error.message);
      };
    });
  };

  app.Backend.prototype.saveData = function(data) {
    var self = this;
    // append data
    return new Promise(function(resolve, reject){
      if (!self.dbHandle) {
        reject('Error: No database open.');
      }
      var transaction = self.dbHandle.transaction([self.dbObjectStoreName], "readwrite");
      var objectStore = transaction.objectStore(self.dbObjectStoreName);
      var request;
      try {
        request = objectStore.add(data);
      } catch (e) {
        if (e.name == 'DataCloneError') {
          reject("This engine doesn't know how to clone this type of object, try Firefox");
        }
      }
      request.onerror = function(event) {
        reject(event.target.error.message);
      };
      request.onsuccess = function(event) {
        resolve(data);
      };
    });
  };

  app.Backend.prototype.updateData = function(data) {
    var self = this;
    // append data
    return new Promise(function(resolve, reject){
      if (!self.dbHandle) {
        reject('Error: No database open.');
      }
      var transaction = self.dbHandle.transaction([self.dbObjectStoreName], "readwrite");
      var objectStore = transaction.objectStore(self.dbObjectStoreName);
      var request;
      try {
        request = objectStore.put(data);
      } catch (e) {
        if (e.name == 'DataCloneError') {
          reject("This engine doesn't know how to clone this type of object, try Firefox");
        }
      }
      request.onerror = function(event) {
        reject(event.target.error.message);
      };
      request.onsuccess = function(event) {
        resolve(data);
      };
    });
  };

  app.Backend.prototype.clear = function() {
    var self = this;
    // delete all data
    return new Promise(function(resolve, reject){
      if (!self.dbHandle) {
        reject('Error: No database open.');
      }
      var transaction = self.dbHandle.transaction([self.dbObjectStoreName], "readwrite");
      var objectStore = transaction.objectStore(self.dbObjectStoreName);
      var request = objectStore.clear();
      request.onerror = function(event) {
        reject(event.target.error.message);
      };
      request.onsuccess = function(event) {
        resolve();
      };
    });
  };

  app.Backend.prototype.close = function() {
    var self = this;
    // close the database
    return new Promise(function(resolve, reject){
      if (self.dbHandle) {
        self.dbHandle.close();
        self.dbHandle = undefined;
        resolve();
      } else {
        reject('Error: No database open.');
      }
    });
  };

})(this); // this = window


