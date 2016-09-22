'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Scraper = require('./scraper');

const result = new Schema({
  scraper: { type: Schema.ObjectId, ref: 'Scraper' },
  id: { type: String, unique: true },
  modality: Number,
  number: String,
  agency: String,
  openDate: Date,
  publishDate: Date,
  description: String,
  approved: { type: Boolean, default: false },
  ignored: { type: Boolean, default: false },
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
  }
}, { _id: false });

module.exports = mongoose.model('Result', result);