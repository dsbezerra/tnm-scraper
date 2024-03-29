'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Scraper = require('./scraper');

var result = new Schema({
  scraper: { type: Schema.ObjectId, ref: 'Scraper' },
  _hash: String,
  modality: Number,
  number: String,
  agency: String,
  openDate: Date,
  publishDate: Date,
  extractionDate: Date,
  description: String,
  amount: { type: Number, default: 0 },
  approved: { type: Boolean, default: false },
  ignored: { type: Boolean, default: false },
  exclusive: { type: Boolean, default: false },
  website: String,
  category: {
    id: String,
    name: String
  },
  download: {
    relativeUri: String,
    uri: String,
    fileName: String,
    fileFormat: String
  },
  processed: {
    uri: String,
    fileName: String,
    fileFormat: String
  }
}, { autoIndexID: true });

module.exports = mongoose.model('Result', result);
