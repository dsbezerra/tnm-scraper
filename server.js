#!/bin/env node

const express      = require('express');
const bodyParser   = require('body-parser');
const compression  = require('compression');
const logger       = require('morgan');

const reportTo  = require('./src/error_reporter');

const FilesController = require('./src/controllers/files');
const ScraperAPI = require('./api');

const app = express();

var ip = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || '0.0.0.0';
var port = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 8080;

// Log any uncaughtException before exitting app
process.on('uncaughtException', function (err) {
  console.error(err.stack);

  // Send errors to an e-mail
  reportTo({
      subject: '[ERROR] uncaughtException',
      text: err.stack,
  }, function(err) {
      
      // Exit app after operation 
      process.exit(1);
  });
});


// Middlewares
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(logger('dev'));

var scraperApi = new ScraperAPI();

// Index route
app.get('/', function(req, res) {
  res.send('Cobol!');
});


// TODO(diego): Remove these files endpoints.
//
// *DOC*
// method - POST
// desc - Process a file and extracts or convert to pdf
// endpoint - /files/process
app.post('/files/process', FilesController.process);
app.post('/files/checkProgress', FilesController.checkProgress);


//[Scraper]
//
// *DOC*
// method - GET
// desc - Get all scrapers
// endpoint - /scrapers
//
app.get('/scrapers', scraperApi.getScrapers);

//[Scraper]
//
// *DOC*
// method - GET
// desc - Get the 5 last run scrapers
// endpoint - /scrapers/last
//
app.get('/scrapers/last', scraperApi.getLastRunScrapers);

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
// desc - Get scraper configuration
// endpoint - /scrapers/:id/configuration
//
app.get('/scrapers/:id/configuration', scraperApi.getScraperConfiguration);

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
