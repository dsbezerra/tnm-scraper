'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Scraper = require('./scraper');

const result = new Schema({
  modality: Number,
  number: String,
  agency: String,
  date: Date,
  description: String,
  download: {
    relativeUri: String,
    uri: String,
    fileName: String,
    fileFormat: String
  },
  approved: Boolean,
  website: String,
  scraper: { type: Schema.ObjectId, ref: 'Scraper' }
});

module.exports = mongoose.model('Result', result);