'use strict'

const secrets  = require('./config/secrets');
const _        = require('lodash');
const path     = require('path');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

mongoose.Promise = global.Promise;

const Scraper = require('./src/models/scraper');

const scrape = require('./index');

function ScraperAPI() {
  let self = this;
  
  self.running = null;
  self.init();
}

ScraperAPI.prototype.init = function(req, res) {
  let self = this;
  const db = secrets.db;

  var uri = `mongodb://${db.user}:${db.pwd}@${db.host}:${db.port}/${db.name}`;
  if(process.env.MONGODB_URI) {
    uri = process.env.MONGODB_URI;
  }
  
  mongoose.connect(uri, function(err) {
    if(err) console.log(err);
    else console.log('Connected to database!');
  });

  self.running = [];
}

/**
 * POST /scrapers/run
 * Run a scraper  
 */
ScraperAPI.prototype.runScraper = function(req, res) {

  let self = this;
  
  const id = req.body.id;
  
  if(id && isNaN(id)) {
    Scraper.findById(id, { __v: false }, function (err, scraper) {
      if(err) {
        console.log(err);
      }

      const configPath = path.join('scrapers', scraper._id + '.json');
      const _scraper = scrape(configPath, function (err, result) {
        if(err) {
          // TODO(diego): Emit error event
          console.log(err);
        }
      });

      _scraper.on('error', function(message) {
        //const index = self.running.indexOf(scraper._id);
        //if(index > -1) {
        //  self.running.splice(index, 1);
        //}
        // Emit error to client via socket
      });

      // Add scraper to running
      _scraper.on('start', function(message) {
        //self.running.push(scraper._id);
        updateRunning(scraper, true, function(err, raw) {
          if(err) {
            console.log(err);
          }
          return res.send({ success: true });
        });
      });

      
      _scraper.on('stats', function(stats) {
        
      });

      // On results, save in database and send data to client
      _scraper.on('finish', function(data) {
        // Remove from running
        //const index = self.running.indexOf(scraper._id);
        //if(index > -1) {
        //  self.running.splice(index, 1);
        //}
        updateRunning(scraper, false, function(err, raw) {
          if(err) {
            console.log(err);
          }
        });
        
        // Save in database
        
        // Send saved in db to client

        
      });
      
    });
  }
  else {
    return res.status(500)
              .send(makeError('id params is invalid!'));
  }
}

/**
 * GET /scrapers/running
 */
ScraperAPI.prototype.getRunningScrapers = function(req, res) {
  Scraper.find({ running: true }, { __v: false }, function(err, scrapers) {
    if(err) {
      return res.status(500)
                .send(makeError(err.message,
                                err.code));
    }
    return res.send(makeResponse(true, scrapers));
  });
}

/**
 * GET /scrapers
 * Returns all scrapers in database
 */
ScraperAPI.prototype.getScrapers = function(req, res) {
  Scraper.find({}, { __v: false }, function(err, scrapers) {
    if(err) {
      return res.status(500)
                .send(makeError(err.message,
                                err.code));
    }
    
    return res.send(makeResponse(true, scrapers));
  });
}

/**
 * GET /scrapers/:id
 * Returns the scraper that matches id
 */
ScraperAPI.prototype.getScraperById = function(req, res) {

  let id = req.params.id;
  if(id && isNaN(id)) {
    Scraper.findById(id, { __v: false }, function(err, scraper) {
      if(err) {
        return res.status(500)
                  .send(makeError(err.message,
                                  err.code));
      }
      
      return res.send(makeResponse(true, scraper));
    });
  }
  else {
    return res.status(500)
              .send(makeError('id param is not valid'));
  }
}

/**
 * GET /scrapers/:city
 * Returns the scraper that matches id
 */
ScraperAPI.prototype.getScraperByCity = function(req, res) {

  let city = req.params.id;
  if(city && isNaN(city)) {
    Scraper.find({ city: city }, { __v: false }, function(err, scrapers) {
      if(err) {
        return res.status(500)
                  .send(makeError(err.message,
                                  err.code));
      }

      return res.send(makeResponse(true, scrapers));
    });
  }
  else {
    return res.status(500)
              .send(makeError('id param is not valid'));
  }
}


/**
 * POST /scrapers
 * Inserts a scraper in database
 */
ScraperAPI.prototype.insertScraper = function(req, res) {
  const scraper = req.body;
  if(scraper.name && scraper.city) {
    Scraper.insert({ name: scraper.name, city: scraper.city }, function(err, scraper) {
      if(err) {
        return res.status(500)
                  .send(makeError(err.message,
                                  err.code));
      }
      
      return res.send(makeResponse(true, scraper));
    });
  }
  else {
    return res.status(500)
              .send(makeError('some params are invalid!'));
  }
};

/**
 * UPDATE /scrapers/:id
 * Update a scraper in database
 */
ScraperAPI.prototype.updateScraper = function(req, res) {
  const id = req.params.id;
  const scraper = req.body;
  if(id && isNaN(id) && scraper) {
    Scraper.update({ _id: id }, scraper, function(err, raw) {
      if(err) {
        return res.status(500)
                  .send(makeError(err.message,
                                  err.code));
      }
      
      return res.send(makeResponse(true, raw));
    });
  }
  else {
    return res.status(500)
              .send(makeError('some params are invalid!'));
  }
};

/**
 * DELETE /scrapers/:id
 * Delete a scraper in database
 */
ScraperAPI.prototype.deleteScraper = function(req, res) {
  const id = req.params.id;
  if(id && isNaN(id)) {
    Scraper.remove({ _id: id }, (err, raw) => {
      if(err) {
        return res.status(500)
                  .send(makeError(err.message,
                                  err.code));
      }
      
      return res.send(makeResponse(true, raw));
    });
  }
  else {
    return res.status(500)
              .send(makeError('some params are invalid!'));
  }
};

/**
 * Updates running property
 */
function updateRunning(scraper, running, callback) {
  Scraper.update({ _id: scraper._id }, Object.assign(scraper, { running }), function(err, raw) {
    if(err) {
      return callback(err);
    }

    return callback(null, raw);
  });
}

/**
 * Makes a error response
 */ 
function makeError(message, code) {
  return {
    success: false,
    err: {
      message: message,
      code: code,
    }
  };
}

/**
 * Makes a reponse object
 */
function makeResponse(success, data) {
  let response = {
    success,
    result: {}
  };

  if(typeof data === 'object' && data[0]) {
    response.result['count'] = data.length;
  }

  response.result['data'] = data;
  return response;
}

module.exports = ScraperAPI;