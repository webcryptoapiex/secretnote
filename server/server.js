// server.js (Express 4.0)
var path    = require('path');
var http    = require('http');
var https   = require('https');
var express = require('express');
var app     = express();
var fs      = require('fs');

var privateKey  = fs.readFileSync('../sslcert/server.key', 'utf8');
var certificate = fs.readFileSync('../sslcert/server.crt', 'utf8');
var credentials = { key: privateKey, cert: certificate };

app.use(function(req, res, next) {
  /*
  // Content Security Policy headers
  // default: block all
  // self: script, style, img, font
  res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'");
  res.setHeader("X-Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'");
  res.setHeader("X-WebKit-CSP", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'");
  res.removeHeader("X-Powered-By");
  */
  return next();
});
app.use(express.static(path.join(__dirname, "../public")));

var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

httpServer.listen(80);
httpsServer.listen(443);
