// server.js (Express 4.0)
var path        = require('path');
var http        = require('http');
var https       = require('https');
var express     = require('express');
var bodyParser  = require('body-parser');
var app         = express();
var fs          = require('fs');
var mongoose    = require('mongoose');
var Moment      = require('moment');
var _           = require('lodash');
var colors      = require('colors2');
var limiter     = require('limiter');

var Note        = require('./models/Note.js');
var notes       = require('./routes/notes.js');

var privateKey  = fs.readFileSync('../sslcert/server.key', 'utf8');
var certificate = fs.readFileSync('../sslcert/server.crt', 'utf8');
var credentials = { key: privateKey, cert: certificate };

// Connect to mongoDB
mongoose.connect('mongodb://localhost/notes');

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

// parse application/json
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, "../public")));

app.use('/api/v1/notes', notes);

var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

httpsServer.listen(process.env.PORT || 443);

// Clean up the database every 60 seconds.
setInterval(function(){
  var now = new Moment();
  Note.remove({ expires_at: { $lte: now.toDate() } }, function(err, docs){
    if (err) {
      console.error('Error:', err);
    }
  });
}, 1000*60);
