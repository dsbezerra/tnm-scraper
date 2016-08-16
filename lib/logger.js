var colors = require('colors/safe');


// TODO(diego): Support print of objects and arrays with details

var SECONDS_IN_MILLIS = 1000;
var MINUTES_IN_MILLIS = SECONDS_IN_MILLIS * 60;
var HOURS_IN_MILLIS   = MINUTES_IN_MILLIS * 60;

var LogLevel = {
  error: {
    level: 0,
    name: 'ERROR',
    color: 'red'
  },

  info: {
    level: 1,
    name: 'INFO',
    color: 'yellow'
  },

  warn: {
    level: 2,
    name: 'WARN',
    color: 'cyan'
  },

  debug: {
    level: 3,
    name: 'DEBUG',
    color: 'green'
  },

  verbose: {
    level: 4,
    name: 'VERBOSE',
    color: 'white'
  }
}

var logLevel = LogLevel.warn;

function Logger(options) {
  var self = this;

  if(!options) {
    options = {};
  }

  if(options.VERBOSE) {
    logLevel = LogLevel.verbose;
  }

  if(options.DEBUG) {
    logLevel = LogLevel.debug;
  }
}


function getTimestamp() {
  return getTimestamp(null);
}

function getTimestamp(options) {
  var now = new Date();
  
  if(options) {
    // Day, Month, Year, dunno
  }
  
  var hours = addZero(now.getHours());
  var minutes = addZero(now.getMinutes());
  var seconds = addZero(now.getSeconds());

  return `${hours}:${minutes}:${seconds}`;
}

function addZero(i) {
  if (i < 10) {
    i = '0' + i;
  }

  return i;
}

function isLoggable(level) {
  return level <= logLevel.level; 
}

/**
 * Prints in te console the message
 * @param {tag} string Who logs the message
 * @param {message} string Message to be logged
 * @param {LOG} object LogLevel object
 */
function print(tag, message, LogLevel, data) {

  if(!isLoggable(LogLevel.level)) {
    return;
  }

  if(typeof message === 'undefined') {
    message = tag;
    tag = null;
  }

  var timestamp = getTimestamp();

  var levelName = LogLevel.name;
  var log = `[ ${timestamp} ] `;
  log += `(${levelName}) `;
  
  if(tag) {
    log += `- ${tag}: `;
  }

  log += message;

  var color = LogLevel.color;
  console.log(colors[color](log));

  if(data) {
    // Handle data
  }
}

/**
 * Logs an error message
 * @param {tag} string Who logs the message
 * @param {message} string Message to be logged
 */
Logger.prototype.e = function(tag, message) {
  print(tag, message, LogLevel.error);
}

/**
 * Logs an info message
 * @param {tag} string Who logs the message
 * @param {message} string Message to be logged
 */
Logger.prototype.i = function(tag, message) {
  print(tag, message, LogLevel.info);
}

/**
 * Logs an info message with data
 * @param {tag} string Who logs the message
 * @param {message} string Message to be logged
 * @param {data} object Data to be logged
 */
Logger.prototype.i = function(tag, message, data) {
  print(tag, message, LogLevel.info, data);
}

/**
 * Logs a warning message
 * @param {tag} string Who logs the message
 * @param {message} string Message to be logged
 */
Logger.prototype.w = function(tag, message) {
  print(tag, message, LogLevel.warn);
}

/**
 * Logs a debug message
 * @param {tag} string Who logs the message
 * @param {message} string Message to be logged
 */
Logger.prototype.d = function(tag, message) {
  print(tag, message, LogLevel.debug);
}

/**
 * Logs a verbose message
 * @param {tag} string Who logs the message
 * @param {message} string Message to be logged
 */
Logger.prototype.v = function(tag, message) {
  print(tag, message, LogLevel.verbose);
}

module.exports = Logger;