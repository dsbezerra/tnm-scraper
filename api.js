var secrets = require('./config/secrets');
var uuid = require('node-uuid');
var _ = require('lodash');
var path = require('path');
var mongoose = require('mongoose');

var objectAssign = require('object-assign');

var Scraper = require('./src/models/scraper');
var Result = require('./src/models/result');

var fileutils = require("./src/utils/fileutils");

var reportTo = require('./src/email_reporter');
var scrape = require('./index');

var SCRAPERS_DIR = process.env.OPENSHIFT_DATA_DIR + '/scrapers' || './scrapers';

// THIS IS NOT FINISHED... BUT WORKS...
// TODO(diego): Rewrite in Go and make it better, faster :D

function ScraperAPI() {
  var self = this;
  
  self.progress = null;
  
  self.dbUri = null;
  
  self.init();
  self.connectToDatabase();
}

// Initialize scraper api
ScraperAPI.prototype.init = function() {
  var self = this;
  var db = secrets.db;

  var uri = 'mongodb://' + 
	db.user + ':' + db.pwd + '@' + db.host + ':' + 
	db.port + '/' + db.name;
	
  if (process.env.MONGODB_URI) {
    uri = process.env.MONGODB_URI;
  }
  
  self.dbUri = uri;
  self.progress = {};
}

// Connects to tnm-scraper database
ScraperAPI.prototype.connectToDatabase = function(callback) {
  var self = this;
  mongoose.connect(self.dbUri, function(err) {
    if (err) { 
      console.log(err);
    }
    else {
      console.log('Connected to database!');
    }
  });
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
      } 
      else {
        var options = {
          scraper: scraper,
        };

        if (scraper.running) {
          //
          // TODO(diego): Save task id to database while the scraper is running,
          // so we can return the progress when we fall here.
          //
          return res.send({
            success: false,
            message: 'Scraper is already running!',
          });
        }
        
        var configPath = path.join(SCRAPERS_DIR, scraper._id + '.json');
        var _scraper = scrape(configPath, options, function(err, results) {
          // Set scraper as not running
          updateRunning(scraper, false);
          if (err) {
            // TODO(diego): Emit error event
            console.log(err);
            reportTo({
              subject: '[ERROR] SCRAPER #' + scraper._id, 
              text: err.message
            });
          }
          else {
            // If we ran successfully then save results in database
            if (results && results.length > 0) {
              for (var i = 0; i < results.length; ++i) {
                results[i].scraper = scraper._id;
                var r = new Result(results[i]);
                r.save();
              }
            } 
          }
        });

        // 
        // onError Event: not handled for now.
        //
        _scraper.on('error', function(message) {});

        // 
        // onStart Event: Updates scraper status in database.
        // Will be useful in future
        //
        _scraper.on('start', function(message) {
          // Update scraper as running  in database
          updateRunning(scraper, true, function(err, raw) {
            if (err) {
              console.log(err);
              reportTo({
                subject: '[ERROR] SCRAPER #' + scraper._id, 
                text: err.message
              });
            }
            return res.send({
              success: true,
              taskId: taskId
            });
          });
        });
        
        //
        // onFinish Event: Deletes the task progress
        //
        _scraper.on('finish', function(data) {
          console.log('Removing progress data in 5s');
          setTimeout(function() {
            delete self.progress[taskId];
            console.log('Removed ' + taskId + ' progress data!');
          }, 5000);
          
          // Update in the database as not running
          updateRunning(scraper, false);
        });
        
        //
        // onStats Event: We keep track of current task progress
        // by using its ID to update with current statistics from Scraper!
        //
        _scraper.on('stats', function(stats) {          
          var oldProgress = self.progress[taskId];

          if (!oldProgress) {
            self.progress[taskId] = stats;
            self.progress[taskId].new = true;
            return;
          }
          
          if (checkForNewData(oldProgress, stats)) {
            self.progress[taskId] = stats;
            self.progress[taskId].new = true;
          }
        });
      }
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
 * GET /scrapers/last
 * Returns last 5 run scrapers
 */
ScraperAPI.prototype.getLastRunScrapers = function(req, res) {

  Scraper
    .find({}, { __v: false })
    .limit(5)
    .sort({ lastRunDate: -1 })
    .exec(function(err, scrapers) {
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
 * GET /scrapers/:id/configuration
 * Returns the scraper configuration
 */
ScraperAPI.prototype.getScraperConfiguration = function(req, res) {

  var id = req.params.id;
  if (id) {
    var configPath = path.resolve('./scrapers');
    var scraperConfigPath = path.join(configPath, id + '.json');

    if (fileutils.isFile(scraperConfigPath)) {
      var configFile = fileutils.readFile(scraperConfigPath, { encoding: 'utf8' });
      if (configFile) {
        try {
          var config = JSON.parse(configFile);
          return res.send(makeResponse(true, { id: id, config: config }));
        } catch (err) {
          return res.status(500)
                    .send(makeError('Config file JSON is incorrect!'));
        }
      }
      else {
        console.log('Couldn\'t read file!');
        return res.status(500)
                  .send(makeError('Couldn\'t read file!'));
      }
    }
    else {
      console.log('Is not a file!');
      return res.status(500)
                .send(makeError('It is not a file!'));
    }
  }
  else {
    return res.status(500)
      .send(makeError('Invalid params.'));
  }
}

/**
 * GET /scrapers/pending/:id
 */
ScraperAPI.prototype.getPendingFromScraper = function(req, res) {
  var id = req.params.id;
  if (id) {
    Result
      .find({ scraper: id, approved: false }, { __v: false })
      .sort({ openDate: 1 })
      .exec(function(err, pending) {
        if(err) {
          return res.status(500)
                    .send(makeError(err.message,
                                    err.code));
        }
        
        var include = req.query.include;
        if (include && include === 'scraper') {
          Scraper
            .findById(id)
            .exec(function(err, scraper) {
              if (err) {
                console.log(err);
              }

              return res.send({
                success: true,
                result: {
                  data: {
                    scraper: scraper,
                    results: pending,
                  },
                },
              });
            });
        } else {
          return res.send(makeResponse(true, pending));
        }
      });
  } 
  else {
    return res.status(500)
              .send(makeError('id param is not valid'));
  }
}

/**
 * GET /scrapers/checkProgres/:id
 */
ScraperAPI.prototype.checkProgress = function(req, res) {

  //
  // Uses long polling to avoid too much requests
  //
  var self = this;
  var id = req.params.id;
  if (id) {

    //
    // Get old progress
    //
    var progress = self.progress[id];
    if (progress.new) {
      return res.send(makeResponse(true, progress));
    }
    else {
      // If not check again until we have new data or connection timeouts.
      setTimeout(function() {
        //console.log('checking progress again...');
        self.checkProgress(req, res);
      }, 500);
    }
    
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
        return res.status(500)
                  .send(makeError(err.message, err.code));
      }

      if (scraper.config) {
        // Save config to disk
        var configPath = path.resolve(SCRAPERS_DIR);
        var scraperConfigPath = path.join(configPath, saved._id + '.json');

        // Save as json config file
        try {
          var string = JSON.stringify(scraper.config);
          if (string) {
            fileutils.writeFile(scraperConfigPath, string);
          }
        } catch (err) {
          console.log(err);
        }
      }

      return res.send(makeResponse(true, saved));
    });
  } else {
    return res.status(500)
      .send(makeError('some params are invalid!'));
  }
};

/**
 * PUT /scrapers/:id
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
                  .send(makeError(err.message, err.code));
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
 * PUT /results/:id
 * Update a result in database
 */
ScraperAPI.prototype.updateResultById = function(req, res) {
  var id = req.params.id;
  var result = req.body;
  if (id && isNaN(id) && result) {
    Result.update({
      _id: id
    }, result, function(err, raw) {
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
    success: success,
    result: {}
  };

  if (typeof data === 'object' && data[0]) {
    response.result['count'] = data.length;
  }

  response.result['data'] = data;
  return response;
}

/**
 * Updates running property
 */
function updateRunning(scraper, running, callback) {

  var obj = {
    running: running
  }

  if (running) {
    obj.lastRunDate = new Date();
  }

  Scraper.update({
    _id: scraper._id,
  }, objectAssign(scraper, obj), function (err, raw) {
    if (err) {
      if (typeof callback === 'function') 
        return callback(err);
    }

    if (typeof callback === 'function') {
      return callback(null, raw);
    }
  });
}

//
// Check for new data in progress
//
function checkForNewData(oldProgress, newProgress) {
  var result = false;

  if (!oldProgress || !newProgress) {
    result = true;
    return result;
  }

  result = oldProgress.isRunning      !== newProgress.isRunning      ||
           oldProgress.totalBiddings  !== newProgress.totalBiddings  ||
           oldProgress.totalExtracted !== newProgress.totalExtracted ||
           oldProgress.currentBidding !== newProgress.currentBidding ||
           oldProgress.newBiddings    !== newProgress.newBiddings    ||
           oldProgress.currentTask    !== newProgress.currentTask    ||
           oldProgress.message        !== newProgress.message;

  return result;
}

module.exports = ScraperAPI;
