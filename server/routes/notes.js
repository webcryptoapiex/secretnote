var express   = require('express');
var Moment    = require('moment');
var base64    = require('base64-js');
var _         = require('lodash');
var CryptoJS  = require('cryptojs').Crypto;
var limiter   = require('limiter');
var router    = express.Router();

var mongoose  = require('mongoose');
var Note      = require('../models/Note.js');

// =============
// API v1 routes
// =============
//
var NOTE_KEEPTIME_IN_HOURS = 24;

// Rate limiter configuration
var RateLimiter = require('limiter').RateLimiter;
var limitByHour = new RateLimiter(200, 'hour', true); // 200 messages per hour allowed, fire CB immediately when over
var limitByRate = new RateLimiter(1, 1000);           // 1000ms between requests

// POST /api/v1/notes
router.post('/', function(req, res, next) {
  // limit amount by hour
  limitByHour.removeTokens(1, function(err, remainingRequests) {
    if (remainingRequests < 0) { // fail normally when over limit
      res.status(400);
      res.send({ status: 'ERROR', message: 'Failed.' });
    } else {
      var now = new Moment();
      try {
        var postData = req.body;
        var buffer = new Buffer(postData.fingerprint, "hex");
        var fingerprint = buffer.toJSON().data;
        var data = postData.data;
        if (_.isArray(fingerprint) && fingerprint.length === 20 && data.length < 32768) {
          var hash = CryptoJS.SHA1(data);
          var note = new Note({
            created_at: now.toDate(),
            expires_at: new Moment(now).add(NOTE_KEEPTIME_IN_HOURS, 'hours').toDate(),
            fingerprint: fingerprint,
            hash: hash.toString(),
            data: data
          });
          note.save(function (err) {
            if (err) { // invalid data or connection failed
              res.status(400);
              res.send({ status: 'ERROR', message: 'Failed.' });
            } else {
              res.status(200);
              res.json({ status: 'OK' });
            }
          });
        } else { // invalid fingerprint length
          res.status(400);
          res.send({ status: 'ERROR', message: 'Failed.' });
        }
      } catch (e) { // invalid data
        res.status(400);
        res.send({ status: 'ERROR', message: 'Failed.' });
      }
    }
  });
});

// GET /api/v1/notes/:fingerprint
router.get('/:fingerprint', function(req, res, next) {
  // limit by rate
  limitByRate.removeTokens(1, function() {
    var now = new Moment();
    try {
      var buffer = new Buffer(req.params.fingerprint, "hex");
      var id = buffer.toJSON().data;
      if (_.isArray(id) && id.length === 20) {
        Note.find({
          fingerprint: id,
          expires_at: { $gt: now.toDate() }
        },
        null,
        {
          sort: { 'created_at': -1 }
        },
        function(err, notes){
          if (err) {
            res.status(200);
            res.json([]);
            //res.send({ status: 'ERROR', message: 'Failed.' });
          } else {
            res.status(200);
            res.json(notes);
          }
        });
      } else {
        res.status(400);
        res.send({ status: 'ERROR', message: 'Failed.' });
      }
    } catch (e) {
      res.status(400);
      res.send({ status: 'ERROR', message: 'Failed.' });
    }
  });
});

// NOTE: count is disabled for security reasons
// GET /api/v1/notes/count
/*
router.get('/count', function(req, res, next) {
  // limit by rate
  limitByRate.removeTokens(1, function() {
    Note.count({}, function(err, c)
    {
      res.status(200);
      res.json({ status: 'OK', count: c });
    });
  });
});
*/

// NOTE: Get all notes is disabled for security reasons
// GET /api/v1/notes
/*
router.get('/', function(req, res, next) {
  // limit by rate
  limitByRate.removeTokens(1, function() {
    var now = new Moment();
    try {
      Note.find({ expires_at: { $gt: now.toDate() } }, function(err, notes){
        if (err) {
          res.status(400);
          res.send({ status: 'ERROR', message: 'Failed.' });
        } else {
          res.status(200);
          res.json(notes);
        }
      });
    } catch (e) {
      res.status(400);
      res.send({ status: 'ERROR', message: 'Failed.' });
    }
  });
});
*/

module.exports = router;

