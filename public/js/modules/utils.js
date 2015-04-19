// Copyright 2015 Mika "Fincodr" Luoma-aho
// Provided under the MIT license. See LICENSE file for details.
(function(parent){
  "use strict";

  // The main application module
  var app = parent.app = parent.app || {};

  // utils module
  app.utils = (function(){

    var self = this;

    var module = {
      stringPadRight: function(str, len, ch) {
        var chx = ch || ' ';
        while(str.length < len) {
          str += chx;
        }
        return str;
      },

      stringPadLeft: function(s, len, ch) {
        var str = '', chx = ch || ' ';
        while(str.length + s.length < len) {
          str += chx;
        }
        str += s;
        return str;
      },

      compareTwoUint8Arrays: function(a,b) {
        if (a.length===b.length) {
          for (var i=0, len=a.length; i!==len; ++i) {
            if (a[i]!==b[i]) {
              return false;
            }
          }
          return true;
        }
        return false;
      },

      convertTextToUint8Array: function(s) {
        var data = new Uint8Array(s.length);
        for (var i=0, len=s.length; i!==len; ++i) {
          data[i] = s.charCodeAt(i);
        }
        return data;
      },

      utf8_to_b64: function(str) {
        return window.btoa(unescape(encodeURIComponent(str)));
      },

      decodeBase64url: function(str) {
        str = (str + '==').slice(0, str.length + (str.length % 2));
        return str.replace(/-/g, '+').replace(/_/g, '/');
      },

      convertTextToArrayBuffer: function(s) {
        var buf = new ArrayBuffer(s.length);
        var view = new Uint8Array(buf);
        for (var i=0, len=s.length; i!==len; ++i) {
          view[i] = s.charCodeAt(i);
        }
        return buf;
      },

      packUint8Arrays: function() {
        // generate big enough new array z
        var i, len, ptr, count = arguments.length, totalLength = 0;
        for (i=0; i!==count; ++i) {
          if (arguments[i]) {
            totalLength += arguments[i].length;
          }
        }
        var z = new Uint8Array(totalLength + count*2);
        // copy data
        for (i=0, ptr=0; i!==count; ++i) {
          if (arguments[i]) {
            len = arguments[i].length;
            z.set(arguments[i], ptr + 2);
          } else {
            len = 0;
          }
          var datalen = new Uint16Array(2);
          datalen[0] = len >> 8;
          datalen[1] = len - (datalen[0]*256);
          if (len > 65535) {
            throw new Error('packUint8Arrays supports max length of 65535 bytes of data per packed component');
          }
          z.set(datalen, ptr);
          ptr += len + 2;
        }
        return z;
      },

      unpackUint8Arrays: function(data) {
        var i = 0, len, ptr = 0, totalLength = data.length;
        var z = [];
        // copy data
        while (ptr < totalLength) {
          len = data[ptr] * 256 + data[ptr+1];
          if (ptr+2+len > totalLength) {
            throw new Error('unpackUint8Arrays out of bounds!');
          }
          z.push(data.subarray(ptr + 2, ptr + 2 + len));
          ptr += len + 2;
          ++i;
        }
        return z;
      },

      concatUint8Arrays: function() {
        // generate big enough new array z
        var i, ptr = 0, totalLength = 0;
        for (i=0; i!==arguments.length; ++i) {
          totalLength += arguments[i].length;
        }
        var z = new Uint8Array(totalLength);
        // copy data
        for (i=0; i!==arguments.length; ++i) {
          z.set(arguments[i], ptr);
          ptr += arguments[i].length;
        }
        return z;
      },

      convertBase64ToUint8Array: function(data) {
        var binary = window.atob(data);
        var len = binary.length;
        var buf = new ArrayBuffer(len);
        var view = new Uint8Array(buf);
        for (var i=0; i!==len; ++i) {
          view[i] = binary.charCodeAt(i);
        }
        return view;
      },

      convertUint8ArrayToBase64: function(data) {
        var s = module.convertUint8ArrayToText(data);
        return window.btoa(s);
      },

      convertUint8ArrayToText: function(data) {
        var s = '';
        for (var i=0, len=data.length; i!==len; ++i) {
          s += String.fromCharCode(data[i]);
        }
        return s;
      },

      convertArrayBufferToText: function(data) {
        var s = '';
        for (var i=0, len=data.byteLength; i!==len; ++i) {
          s += String.fromCharCode(data[i]);
        }
        return s;
      },

      convertArrayBufferToUint8Array: function(data) {
        var a = new Uint8Array(data.byteLength);
        for (var i=0, len=data.byteLength; i!==len; ++i) {
          a[i] = data[i];
        }
        return a;
      },

      convertUint8ArrayToArrayBuffer: function(data) {
        var a = new ArrayBuffer(data.length);
        for (var i=0, len=data.length; i!==len; ++i) {
          a[i] = data[i];
        }
        return a;
      },

      convertUint8ArrayToHex: function(data, sep) {
        var a, h = '';
        var ch = sep===null?' ':sep;
        for (var i=0, len=data.length; i!==len; ++i) {
          a = data[i];
          h += i>0?ch:'';
          h += a<16?'0':'';
          h += a.toString(16);
        }
        return h;
      },

      convertUint8ArrayToHexView: function(data, width, sep) {
        var a, h = '', s = '';
        var ch = sep===undefined?' ':sep;
        var n = 0;
        h = '[length: ' + data.length + ' bytes (' + data.length * 8 + ' bits)]\n';
        for (var i=0, len=data.length; i!==len; ++i) {
          a = data[i];
          h += n>0?ch:'';
          h += a<16?'0':'';
          h += a.toString(16);
          n++;
          s += ((a>=97 && a<=122)|(a>=65 && a<=90)|(a>48 && a<=57))?String.fromCharCode(a):'.';
          if (n===width) {
            h += '  ' + s;
            h += '\n';
            n=0;
            s='';
          }
        }
        if (n!==0) {
          h += '  ' + module.stringPadLeft('', (width-n)*3) + s;
        }
        return h;
      }

    };

    return module;

  })();

})(this); // this = window


