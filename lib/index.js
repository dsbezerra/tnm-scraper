var scraper = require('./scraper'),
    fs = require('fs');

var defaultEnconding = 'utf-8';

function scrape(config, options, callback) {
  if(typeof config === 'undefined') {
    throw new Error('undefined is not a valid config path.')
  }

  if(typeof options === 'function') {
    callback = options;
    options = {};
  }
  
  parseConfig(config, function(result) {
    
    // Append options and callback to config
    result= Object.assign(result, options);
    result.callback = callback;
    return new scraper(result);
  });
}

/**
 * Parse a json config file to javascript object
 * @param {string} configPath Absolute path to config file
 * @param {object} options Options of scraper
 */
function parseConfig(configPath, callback) {
  if(typeof configPath !== 'string') {
    throw new Error('configPath must be an absolute path');
  }

  fs.readFile(configPath, defaultEnconding, function(err, contents) {
    if(err) {
      throw new Error(err.message);
    }

    var result = {};
    result = JSON.parse(contents);
    callback(result);
   
  });
}

module.exports = scrape;