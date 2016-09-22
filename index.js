var scraper = require('./src/scraper'),
    fs = require('fs'),
    path = require('path');

var defaultEnconding = 'utf-8';

function scrape(config, options, callback) {
  if(typeof config === 'undefined') {
    throw new Error('undefined is not a valid config path.')
  }

  if(typeof options === 'function') {
    callback = options;
    options = {};
  }
  
  var _config = parseConfig(config);
  // Append options and callback to config
  _config = Object.assign(_config, options);
  if(config.scraper) {
    _config.scraper = config.scraper;
  }
  _config.callback = callback;

  return new scraper(_config);
}

/**
 * Parse a json config file to javascript object
 * @param {string} configPath Absolute path to config file
 * @param {object} options Options of scraper
 */
function parseConfig(config) {
  var configPath = config;
  if(typeof config !== 'string') {
    if(config.scraper) {
      configPath = path.join('scrapers', config.scraper._id + '.json');
    }
    else {
      throw new Error('scraper configuration not found!');
    }
  }
  else if(typeof config === 'undefined' || typeof config === 'null') {
    throw new Error('scraper configuration must be valid!');
  }

  var fileContents = fs.readFileSync(configPath, defaultEnconding);
  var result = JSON.parse(fileContents);
  return result;
}

module.exports = scrape;