var fs   = require('fs');
var path = require('path');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var scrape = require('./index');

mongoose.Promise = global.Promise;

const Scraper = require('./src/models/scraper');
const Result  = require('./src/models/result');


const FROM_DB = true;

if(FROM_DB) {
  const user = 'scraper';
  const pwd = '123456';
  
  const uri =
    `mongodb://${user}:${pwd}@localhost:27017/tnm`;
  
  mongoose.connect(uri, function(err) {
    if(err) {
      console.log(err);
      return;
    }

    findScraperIncludingLastResults('57db1f6d8bc35e17001fc0b5', function(err, scraper) {
      if(err) return;
      
      var scraperPath = path.join('scrapers', scraper._id + '.json');
      var dirPath = path.resolve('scrapers');

      if(checkValidPaths(dirPath, scraperPath)) {
        runScraper(scraperPath, scraper, handleResult);
      }
    });
  });
}
else {

  // Local
  const scraperPath = path.join('scrapers', 'sp/sao_paulo/config.json');
  runScraper(path, function(err, result) {
    if(err) {
      console.log(err);
      return;
    }

    console.log(result);
  });
}

/**
 * Runs the scraper
 */
function runScraper(path, scraper, callback) {
  if(!path) return;

  let options = {
    scraper: scraper,
  };
  
  var scraperTask = scrape(path, options, function(err, result) {
    if(err) return callback(null);
    if(result) return callback(null, scraper, result);
  });
}

/**
 * Handles the result from scraper
 */
function handleResult(err, scraper, results) {
  if(err) {
    console.log(err);
    return;
  }

  if(results.length > 0) {
    for(var i = 0; i < results.length; ++i) {
      results[i].scraper = scraper._id;
      results[i].approved = false;
      results[i].ignored = false;
    }
    
    Result.collection.insert(results, function(err, result) {
      if(err) {
        console.log(err);
      }
      
      console.log(result);
    });
  }
  else {
    console.log("Nenhum item novo!");
    process.exit();
  }
  
}

function findScraperIncludingLastResults(id, callback) {
  Scraper.find({ _id: id }).lean().limit(1).exec(function(err, scrapers) {
    if(err) {
      return callback(err);
    }

    var scraper = scrapers[0];
    if(scraper) {
      Result.find({ scraper: scraper._id }).lean().exec(function(err, results) {
        if(err) {
          return callback(err);
        }

        var r = {
          ids: [],
          results: {},
        };

        for(var i = 0; i < results.length; ++i) {
          var item = results[i];
          r.ids.push(item._id);
          r.results[item._id] = item;
        }
        
        scraper.lastResults = r;
        return callback(null, scraper);
      });
    }
  });
}

/**
 * Check if paths are valid
 */
function checkValidPaths(dirPath, scraperPath) {

  let isValid = true;
  
  if(!isDirectory(dirPath)) {
    fs.mkdirSync(dirPath);
  }

  if(!isFile(scraperPath)) {
    console.log('Couldn\'t find file ' + scraperPath);
    return false;
  }

  return isValid;
}

/**
 * Check if path is directory
 */
function isDirectory(path) {
  try {
    const stat = fs.statSync(path);
    return stat.isDirectory();  
  } catch(ex) {
    return false;
  }
}

/**
 * Check if path is file
 */
function isFile(path) {
  try {
    const stat = fs.statSync(path);
    return stat.isFile();  
  } catch(ex) {
    return false;
  }
}