#!/bin/env node

const express      = require('express');
const bodyParser   = require('body-parser');
const compression  = require('compression');
const logger       = require('morgan');

const FilesController = require('./src/controllers/files');
const ScraperAPI = require('./api');

const app = express();

var ip = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || '0.0.0.0';
var port = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 8080;

// Middlewares
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(logger('dev'));

var scraperApi = new ScraperAPI();

app.get('/', function(req, res) {
  res.send('Cobol!');
});


//[Scraper]
//
// *DOC*
// method - GET
// desc - Get all scrapers
// endpoint - /scrapers
//
app.get('/scrapers', scraperApi.getScrapers);

// *DOC*
// method - GET
// desc - Get all running scrapers
// endpoint - /scrapers/running
//
app.get('/scrapers/running', scraperApi.getRunningScrapers);

//
// *DOC*
// method - GET
// desc - Get one scraper
// endpoint - /scrapers/:id
//
app.get('/scrapers/:id', scraperApi.getScraperById);

//
// *DOC*
// method - GET
// desc - Get scrapers by city
// endpoint - /scrapers/city/:id
//
app.get('/scrapers/city/:id', scraperApi.getScraperByCity);

//
// *DOC*
// method - GET
// desc - Get pending results from a scraper
// endpoint - /scrapers/pending/:id
//
app.get('/scrapers/pending/:id', scraperApi.getPendingFromScraper);

//
// *DOC*
// method - GET
// desc - Check progress of running scraper
// endpoint - /scrapers/checkProgress/:id
//
app.get('/scrapers/checkProgress/:id', function(req, res) {
  scraperApi.checkProgress.apply(scraperApi, [req, res]);
});

//
// *DOC*
// method - POST
// desc - Process a file and extracts or convert to pdf
// endpoint - /files/process
app.post('/files/process', FilesController.process);

app.post('/files/checkProgress', FilesController.checkProgress);

// Inserts a scraper
app.post('/scrapers', scraperApi.insertScraper);

// Run a scraper
app.post('/scrapers/run', function(req, res) {
  scraperApi.runScraper.apply(scraperApi, [req, res]);
});

// Updates a scraper
app.put('/scrapers/:id', scraperApi.updateScraper);

// Delete a scraper
app.delete('/scrapers/:id', scraperApi.deleteScraper);

// Updates a result
app.put('/results/:id', scraperApi.updateResultById);

app.listen(port, ip, function() {
  console.log('Server started listening...');
});