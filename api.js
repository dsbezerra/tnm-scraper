'use strict'

var secrets = require('./config/secrets');
var uuid = require('node-uuid');
var _ = require('lodash');
var path = require('path');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

mongoose.Promise = global.Promise;

var Scraper = require('./src/models/scraper');
var Result = require('./src/models/result');

var fileutils = require("./src/utils/fileutils");
var networkutils = require('./src/utils/networkutils');

var scrape = require('./index');

function ScraperAPI() {
  var self = this;

  self.progress = null;

  self.init();
}

ScraperAPI.prototype.init = function() {
  var self = this;
  var db = secrets.db;

  var uri = 'mongodb://' + 
	db.user + ':' + db.pwd + '@' + db.host + ':' + 
	db.port + '/' + db.name;
	
  if (process.env.MONGODB_URI) {
    uri = process.env.MONGODB_URI;
  }

  mongoose.connect(uri, function(err) {
    if (err) console.log(err);
    else console.log('Connected to database!');
  });

  self.progress = {};
}

/**
 * POST /scrapers/run
 * Run a scraper  
 */
ScraperAPI.prototype.runScraper = function(req, res) {

  var self = this;

  var id = req.body.id;
  var taskId = uuid.v1();

  if (id && isNaN(id)) {
    findScraperIncludingLastResults(id, function(err, scraper) {
      if (err) {
        console.log(err);
      } else {
        var options = {
          scraper: scraper,
        };
        var configPath = path.join('scrapers', scraper._id + '.json');
        var _scraper = scrape(configPath, options, function(err, results) {

          updateRunning(scraper, false, function(err, raw) {
            if (err) {
              console.log(err);
            }
          });

          if (err) {
            // TODO(diego): Emit error event
            console.log(err);
          }

          // Save in database
          if (results.length > 0) {
            for (var i = 0; i < results.length; ++i) {
              results[i].scraper = scraper._id;
              var r = new Result(results[i]);
              r.save();
            }
          } else {
            delete self.progress[taskId];
          }
        });

        _scraper.on('error', function(message) {

        });

        // Add scraper to running
        _scraper.on('start', function(message) {

          updateRunning(scraper, true, function(err, raw) {
            if (err) {
              console.log(err);
            }
            return res.send({
              success: true,
              taskId: taskId
            });
          });
        });


        _scraper.on('stats', function(stats) {
          self.progress[taskId] = stats;
        });

        // On results, save in database and send data to client
        _scraper.on('finish', function(data) {
          // Remove from running
          console.log(data);
          delete self.progress[taskId];
        });
      }
    });
  } else {
    return res.status(500)
      .send(makeError('id params is invalid!'));
  }
}

/**
 * GET /scrapers/running
 */
ScraperAPI.prototype.getRunningScrapers = function(req, res) {
  Scraper.find({
    running: true
  }, {
    __v: false
  }, function(err, scrapers) {
    if (err) {
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
  Scraper.find({}, {
    __v: false
  }, function(err, scrapers) {
    if (err) {
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

  var id = req.params.id;
  if (id && isNaN(id)) {
    Scraper.findById(id, {
      __v: false
    }, function(err, scraper) {
      if (err) {
        return res.status(500)
          .send(makeError(err.message,
            err.code));
      }

      return res.send(makeResponse(true, scraper));
    });
  } else {
    return res.status(500)
      .send(makeError('id param is not valid'));
  }
}

/**
 * GET /scrapers/:city
 * Returns the scraper that matches id
 */
ScraperAPI.prototype.getScraperByCity = function(req, res) {

  var city = req.params.id;
  if (city && isNaN(city)) {
    Scraper.find({
      city: city
    }, {
      __v: false
    }, function(err, scrapers) {
      if (err) {
        return res.status(500)
          .send(makeError(err.message,
            err.code));
      }

      return res.send(makeResponse(true, scrapers));
    });
  } else {
    return res.status(500)
      .send(makeError('id param is not valid'));
  }
}

/**
 * GET /scrapers/pending/:id
 */
ScraperAPI.prototype.getPendingFromScraper = function(req, res) {
  var id = req.params.id;
  if (id) {
    Result.find({
      scraper: id,
      approved: false
    }, {
      __v: false
    }, function(err, pending) {
      if (err) {
        return res.status(500)
          .send(makeError(err.message,
            err.code));
      }

      return res.send(makeResponse(true, pending));
    });
  } else {
    return res.status(500).
    send(makeError('id param is not valid'));
  }
}

/**
 * GET /scrapers/checkProgres/:id
 */
ScraperAPI.prototype.checkProgress = function(req, res) {
  var self = this;
  var id = req.params.id;
  if (id) {
    return res.send(makeResponse(true, self.progress[id]));
  } else {
    return res.status(500)
      .send(makeError('id param is not valid!'));
  }
}

/**
 * POST /scrapers
 * Inserts a scraper in database
 */
ScraperAPI.prototype.insertScraper = function(req, res) {
  var scraper = req.body;
  if (scraper.name && scraper.city) {
    var s = new Scraper({
      name: scraper.name,
      city: scraper.city
    });
    s.save(function(err, saved) {
      if (err) {
        return res.status(500).
        send(makeError(err.message,
          err.code));
      }

      return res.send(makeResponse(true, saved));
    });
  } else {
    return res.status(500)
      .send(makeError('some params are invalid!'));
  }
};

/**
 * UPDATE /scrapers/:id
 * Update a scraper in database
 */
ScraperAPI.prototype.updateScraper = function(req, res) {
  var id = req.params.id;
  var scraper = req.body;
  if (id && isNaN(id) && scraper) {
    Scraper.update({
      _id: id
    }, scraper, function(err, raw) {
      if (err) {
        return res.status(500)
          .send(makeError(err.message,
            err.code));
      }

      return res.send(makeResponse(true, raw));
    });
  } else {
    return res.status(500)
      .send(makeError('some params are invalid!'));
  }
};

/**
 * DELETE /scrapers/:id
 * Delete a scraper in database
 */
ScraperAPI.prototype.deleteScraper = function(req, res) {
  var id = req.params.id;
  if (id && isNaN(id)) {
    Scraper.remove({
      _id: id
    }, function(err, raw) {
      if (err) {
        return res.status(500)
          .send(makeError(err.message,
            err.code));
      }

      return res.send(makeResponse(true, raw));
    });
  } else {
    return res.status(500)
      .send(makeError('some params are invalid!'));
  }
};

/**
 * Updates running property
 */
function updateRunning(scraper, running, callback) {
  Scraper.update({
    _id: scraper._id
  }, Object.assign(scraper, {
    running: running,
    lastRunDate: new Date()
  }), function(err, raw) {
    if (err) {
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
  var response = {
    success,
    result: {}
  };

  if (typeof data === 'object' && data[0]) {
    response.result['count'] = data.length;
  }

  response.result['data'] = data;
  return response;
}


// Util functions
function findScraperIncludingLastResults(id, callback) {
  Scraper.find({
    _id: id
  }).lean().limit(1).exec(function(err, scrapers) {
    if (err) {
      return callback(err);
    }

    var scraper = scrapers[0];
    if (scraper) {
      Result.find({
        scraper: scraper._id
      }).lean().exec(function(err, results) {
        if (err) {
          return callback(err);
        }

        var r = {
          ids: [],
          results: {},
        };

        for (var i = 0; i < results.length; ++i) {
          var item = results[i];
          r.ids.push(item._hash);
          r.results[item._hash] = item;
        }

        scraper.lastResults = r;
        return callback(null, scraper);
      });
    }
  });
}

module.exports = ScraperAPI;