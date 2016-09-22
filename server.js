const express      = require('express');
const bodyParser   = require('body-parser');
const compression  = require('compression');
const logger       = require('morgan');
const mongodb      = require('mongodb');



const ScraperAPI = require('./api');


const scraperApi = new ScraperAPI();

const app = express();

const ip = process.env.IP || 'localhost';
const port = process.env.PORT || 8080;


// Middlewares
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(logger('dev'));


app.get('/', (req, res) => {
  res.send(scraperApi.getRunningScrapers());
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

// Inserts a scraper
app.post('/scrapers', scraperApi.insertScraper);

// Run a scraper
app.post('/scrapers/run', scraperApi.runScraper);

// Updates a scraper
app.put('/scrapers/:id', scraperApi.updateScraper);

// Delete a scraper
app.delete('/scrapers/:id', scraperApi.deleteScraper);





app.listen(port, ip, () => {
  console.log('Server started listening on %s:%s', ip, port);
});