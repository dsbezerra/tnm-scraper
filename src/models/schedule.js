'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Schedule = new Schema({
  scraper: { type: Schema.ObjectId, ref: 'Scraper' },
  weekday: Number,
  hours: Number,
  minutes: Number,
  frequency: String,
  fileName: String,
  cronExpression: String,
  
});

module.exports = mongoose.model('Schedule', Schedule);
