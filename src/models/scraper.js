'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var MODALITY = {
  PREGAO_PRESENCIAL:  0,
  PREGAO_ELETRONICO:  1,
  CONCORRENCIA:       2,
  CONVITE:            3,
  CONCURSO:           4,
  LEILAO:             5,
  TOMADA_PRECO:       6, 
};

var Scraper = new Schema({
  name: String,
  city: String,
  running: { type: Boolean, default: false },
  hidden: { type: Boolean, default: false },
  lastRunDate: { type: Date },
});

module.exports = mongoose.model('Scraper', Scraper);