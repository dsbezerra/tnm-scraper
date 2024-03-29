var fs       = require('fs');
var path     = require('path');
var mongoose = require('mongoose');

var objectAssign = require('object-assign');

var scrape  = require('./index');
var secrets = require('./config/secrets');

const Scraper = require('./src/models/scraper');
const Result  = require('./src/models/result');

var reportTo = require('./src/email_reporter');
var reportutils = require('./src/utils/reportutils');

var SCRAPER_ID = process.argv[2];

if (!SCRAPER_ID) {
  console.log('You must specify a scraper ID.');
  process.exit(1);
  return;
}

// Connect to database
var db = secrets.db;

var uri = 'mongodb://' + 
	  db.user + ':' + db.pwd + '@' + db.host + ':' + 
	  db.port + '/' + db.name;

if (process.env.MONGODB_URI) {
  uri = process.env.MONGODB_URI;
}

mongoose.connect(uri, function(err) {
  if (err) {
    console.log(err);
    process.exit(1);
    return;
  }

  //
  // Query scraper in database with last results
  //
  queryScraper(function(err, scraper) {

    if (err) {
      console.log(err);
      process.exit(1);
      return;
    }

    //
    // Now run the scraper
    //
    run(scraper);
  });
  
});

//
// Runs a scraper
//
function run(scraper) {

  //
  // Find scraper configuration path
  //
  var scrapersPath = process.env.OPENSHIFT_REPO_DIR + '/scrapers' || 'scrapers';
  var scraperPath = path.join(scrapersPath, scraper._id + '.json');

  //
  // Sets the options
  //
  var options = { scraper: scraper };

  //
  // Begin execution
  //
  var task = scrape(scraperPath, options, function (err, results) {
    if (err) {
      console.log(err);
      process.exit(1);
    }
    else {

      //
      // Save results if we have any
      //
      if (results && results.length > 0) {
        var saved = 0;
        
        for (var resultIndex = 0; resultIndex < results.length; ++resultIndex) {

          //
          // Set scraper reference id
          //
          results[resultIndex].scraper = scraper._id;

          //
          // Save to database
          // 
          var _result = new Result(results[resultIndex]);
          _result.save(function (err) {
            if (!err) {
              saved++;

              if (saved === results.length) {
                updateRunning(scraper, false, function(err) {
                  if (err) {
                    console.log(err);
                  }
                  console.log('All results saved.');

                  //
                  // Send report e-mail
                  //
                  reportTo({
                    subject: '[Relatório de Execução] ' + scraper.name,
                    html: reportutils.createScraperReportHTML(scraper, task.stats),
                  }, function (err) {

                    // Ignore error
                    process.exit(0);
                  });
                });
              }
            } else {
              updateRunning(scraper, false, function(err) {
                if (err) {
                  console.log(err);
                }
                process.exit(0);
              });
            }              
          });
        }
      } else {
  
        updateRunning(scraper, false, function(err) {
          if (err) {
            console.log(err);
          }
          
          //
          // Send report e-mail
          //
          reportTo({
            subject: '[Relatório de Execução] ' + scraper.name,
            html: reportutils.createScraperReportHTML(scraper, task.stats),
          }, function (err) {
            console.log('Nothing new... exitting process.');
            // Ignore error
            process.exit(0);
          });
        });
        
      }
    }
  });

  //
  // Set scraper to running
  //
  task.on('start', function(message) {
    updateRunning(scraper, true);
  });
}

//
// Query scraper with last results included
//
function queryScraper(callback) {

  //
  // Find scraper
  //
  Scraper.find({
    _id: SCRAPER_ID,
  }).lean().limit(1).exec(function (err, scrapers) {
    if (err) {
      return callback(err);
    }

    var scraper = scrapers[0];
    if (scraper) {

      //
      // If scraper is already running, ignore execution
      //
      if (scraper.running) {
        return callback(new Error('Scraper is already running.'));
      }
      
      //
      // Include last results
      //
      Result.find({
        scraper: scraper._id,
      }).lean().exec(function (err, results) {
        if (err) {
          return callback(err);
        }

        //
        // Normalize results data
        //
        var lastResults = {
          ids: [],
          results: {},
        }

        for (var resultIndex = 0;
             resultIndex < results.length;
             ++resultIndex)
          {
            var r = results[resultIndex];
            lastResults.ids.push(r._hash);
            lastResults.results[r._hash] = r;
          }

        //
        // Append to scraper object
        //
        scraper.lastResults = lastResults;

        return callback(null, scraper);
      });
    } else {
      console.log('No scraper found.');
    }
  });
}

//
// Updates scraper running state
//
function updateRunning(scraper, running, callback) {

  //
  // Updates scraper running state in database
  //
  var updated = {
    running: running,
  };

  if (running) {
    updated.lastRunDate = new Date();
  }
  
  Scraper.update({
    _id: scraper._id
  }, objectAssign(scraper, updated), function (err, raw) {
    if (callback) {
      if (err) {
        return callback(err);
      }
      else {
        return callback(null);
      }
    }    
  });
}
