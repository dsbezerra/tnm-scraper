var scraper = require('./src/scraper'),
    fs = require('fs'),
    path = require('path');

var objectAssign = require('object-assign');

var defaultEnconding = 'utf-8';

/**
 * Starts a new scraper app instance
 */
function scrape(config, options, callback) {
  if (typeof config === 'undefined') {
    throw new Error('undefined is not a valid config path.')
  }

  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  
  var parsedConfig = parseConfig(config);
  if (!parseConfig) {
    console.log("Failed to parse configuration. Check if the scraper configuration is valid!");
    return null;
  }
  
  // Append options and callback to config
  parsedConfig = objectAssign(parsedConfig, options);
  if (config.scraper) {
    parsedConfig.scraper = config.scraper;
  }
  parsedConfig.callback = callback;

  return new scraper(parsedConfig);
}

/**
 * Parse a json config file to javascript object
 * @param {string} configPath Absolute path to config file
 * @param {object} options Options of scraper
 */
function parseConfig(config) {
  
  var configPath = config;

  //
  // Get the config file full path
  //
  
  if (typeof config !== 'string') {
    if (config.scraper) {
      configPath = path.join('scrapers', config.scraper._id + '.json');
    }
    else {
      throw new Error('missing scraper data from configuration object!');
    }
  }
  else if (typeof config === 'undefined' || typeof config === 'null') {
    throw new Error('scraper configuration must be valid!');
  }

  //
  // Now that we have a config path, load the config from file
  //
  var result       = null,
      fileContents = null;
  
  try {
    fileContents = fs.readFileSync(configPath, defaultEnconding);
  } catch (err) {
    console.log(err);
    return;
  }

  try {
    
    result = JSON.parse(fileContents);

    //
    // We don't allow empty configurations, so we check here
    // if we have an empty configuration json file
    //

    if (Object.keys(result).length === 0) {
      result = null;
    }
    
  } catch (err) {
    console.log(err.message);
    return;
  }
  
  return result;
}

module.exports = scrape;
