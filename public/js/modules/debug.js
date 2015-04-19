// Copyright 2015 Mika "Fincodr" Luoma-aho
// Provided under the MIT license. See LICENSE file for details.
(function(parent){
  "use strict";

  // The main application module
  var app = parent.app = parent.app || {};

  // debug module
  app.debug = (function(){

    var self = this;

    var module = {
      el: undefined,

      attach: function(el) {
        module.el = el;
      },

      detach: function() {
        module.el = undefined;
      },

      log: function(str) {
        if (module.el!==undefined) {
          // append to DOM element
          //if (module.el.textContent.length!==0) {
          //  module.el.innerHTML = module.el.innerHTML + '<br />';
          //}
          module.el.innerHTML = module.el.innerHTML + '<div class="alert alert-success" role="alert">' + str + '</div>';
          // reveal the appended message
          module.el.scrollTop = module.el.scrollHeight;
        } else {
          console.log.apply(console, arguments);
        }
      },

      error: function(str) {
        if (module.el!==undefined) {
          // append to DOM element
          module.el.innerHTML = module.el.innerHTML + '<div class="alert alert-danger" role="alert">' +
            '<span class="glyphicon glyphicon-exclamation-sign" aria-hidden="true"></span>' +
            '<span class="sr-only">Error:</span> ' + str + '</div>';
          // reveal the appended message
          module.el.scrollTop = module.el.scrollHeight;
        } else {
          console.error.apply(console, arguments);
        }
      },

      info: function(str) {
        if (module.el!==undefined) {
          // append to DOM element
          module.el.innerHTML = module.el.innerHTML + '<div class="alert alert-info" role="alert">' +
            '<span class="glyphicon glyphicon-info-sign" aria-hidden="true"></span>' +
            '<span class="sr-only">Info:</span> ' + str + '</div>';
          // reveal the appended message
          module.el.scrollTop = module.el.scrollHeight;
        } else {
          console.info.apply(console, arguments);
        }
      },

      warn: function(str) {
        if (module.el!==undefined) {
          // append to DOM element
          if (module.el.textContent.length!==0) {
            //module.el.innerHTML = module.el.innerHTML + '<br />';
          }
          module.el.innerHTML = module.el.innerHTML + '<div class="alert alert-warning" role="alert">' +
            '<span class="glyphicon glyphicon-exclamation-sign" aria-hidden="true"></span>' +
            '<span class="sr-only">Warning:</span> ' + str + '</div>';
          // reveal the appended message
          module.el.scrollTop = module.el.scrollHeight;
        } else {
          console.warn.apply(console, arguments);
        }
      },

      clear: function() {
        if (module.el!==undefined) {
          module.el.innerHTML = '';
        }
      }
    };

    return module;

  })();

})(this); // this = window


