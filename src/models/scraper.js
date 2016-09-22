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

const Scraper = new Schema({
  name: String,
  city: String,
  running: { type: Boolean, default: false },
  hidden: { type: Boolean, default: false },
  lastRunDate: { type: Date },
});

module.exports = mongoose.model('Scraper', Scraper);