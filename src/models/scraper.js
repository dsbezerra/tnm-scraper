'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MODALITY = {
  PREGAO_PRESENCIAL:  0,
  PREGAO_ELETRONICO:  1,
  CONCORRENCIA:       2,
  CONVITE:            3,
  CONCURSO:           4,
  LEILAO:             5,
  TOMADA_PRECO:       6, 
};

const scraper = new Schema({
  name: String,
  city: String,
  lastRunDate: { type: Date, default: Date.now },
  newestResult: { type: Schema.ObjectId, ref: 'Result' },
  
});

module.exports = mongoose.model('Scraper', scraper);