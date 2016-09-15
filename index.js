var scraper = require('./src/scraper'),
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
  
  var config = parseConfig(config);
  // Append options and callback to config
  config = Object.assign(config, options);
  config.callback = callback;
  return new scraper(config);
}

/**
 * Parse a json config file to javascript object
 * @param {string} configPath Absolute path to config file
 * @param {object} options Options of scraper
 */
function parseConfig(configPath) {
  if(typeof configPath !== 'string') {
    throw new Error('configPath must be an absolute path');
  }

  var fileContents = fs.readFileSync(configPath, defaultEnconding);
  var result = JSON.parse(fileContents);
  return result;
}

module.exports = scrape;