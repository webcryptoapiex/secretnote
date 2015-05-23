var mongoose = require('mongoose');

var NoteSchema = mongoose.model('Note', {
  name: { type: String },
  created_at: { type: Date, index: true },
  expires_at: { type: Date, index: true },
  fingerprint: { type: Array, index: true },
  data: { type: Array },
  hash: { type: String }
});

module.exports = mongoose.model('Note', NoteSchema);
