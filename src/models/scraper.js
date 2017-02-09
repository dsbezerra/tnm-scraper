'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Scraper = new Schema({
  name: String,
  city: String,
  running: { type: Boolean, default: false },
  hidden: { type: Boolean, default: false },
  lastRunDate: { type: Date },
});

module.exports = mongoose.model('Scraper', Scraper);
