var colors = require('colors/safe');
var path = require('path');
var fs = require('fs');

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
    options = {
      persist: true
    };
  }

  if(options.VERBOSE) {
    logLevel = LogLevel.verbose;
  }

  if(options.DEBUG) {
    logLevel = LogLevel.debug;
  }

  self.options = options;

  var fileName = 'scraper-';
  if(options.name) {
    fileName += options.name;
  }
  else {
    fileName += 'log';
  }
  
  var logFilePath = path.resolve('./logs/' + fileName + '.log');
  
  self.logWriter;
  self.logWriter = fs.createWriteStream(logFilePath, {
    flags: 'w',
    defaultEncoding: 'utf8',
    fd: null,
    mode: 666,
    autoClose: true
  });
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

  return hours + ':' + minutes + ':' + seconds;
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

function printArray(array, color) {
  for (var i = 0; i < array.length; ++i) {
	console.log(colors[color]('Item ' + (i + 1) + ': ' + array[i]));
  }  
}

function printObject(object, color) {
  var keys = Object.keys(object);
  for(var keyIndex = 0;
      keyIndex < keys.length;
      ++keyIndex)
    {
      var key = keys[keyIndex];
      var value = object[key];
      
      if(isObject(value)) {
        printObject(value);
      }
      else if (Array.isArray(value)) {
        printArray(value);
      }
      else {
        if(typeof value === 'string') {
          if (value.length > 50) {
            value = value.substring(0, 47) + '...';
          }
        }
		console.log('\t\t' + colors[colors]('(' + key + ', ' + value + ')'));
      }
    }
}

function isObject(a) {
  return typeof a === 'object';
}

/**
 * Prints in te console the message
 * @param {tag} string Who logs the message
 * @param {message} string Message to be logged
 * @param {LOG} object LogLevel object
 */
Logger.prototype.print = function(tag, message, LogLevel, data) {

  if(!isLoggable(LogLevel.level)) {
    return;
  }

  if(typeof message === 'undefined') {
    message = tag;
    tag = null;
  }

  var timestamp = getTimestamp();

  var levelName = LogLevel.name;
  var log = '[ ' + timestamp + ' ] ';
  log += '(' +  levelName + ')';
  
  if(tag) {
	log += '\t- ' + tag + ': ';
  }

  log += message;

  var color = LogLevel.color;
  console.log(colors[color](log));

  if(this.options.persist) {
    if(this.logWriter) {
      this.logWriter.write(log + '\r\n');
    }
  }

  if(data) {
    console.log(colors[color]('---- BEGIN DATA ----'));
    if (Array.isArray(data)) {
      printArray(data, color);    
    }
    else if (isObject(data)) {
      printObject(data, color);
    }
    console.log(colors[color]('---- END DATA ----'));
  }
}

/**
 * Logs an error message
 * @param {tag} string Who logs the message
 * @param {message} string Message to be logged
 */
Logger.prototype.e = function(tag, message) {
  this.print(tag, message, LogLevel.error);
}

/**
 * Logs an info message
 * @param {tag} string Who logs the message
 * @param {message} string Message to be logged
 */
Logger.prototype.i = function(tag, message) {
  this.print(tag, message, LogLevel.info);
}

/**
 * Logs an info message with data
 * @param {tag} string Who logs the message
 * @param {message} string Message to be logged
 * @param {data} object Data to be logged
 */
Logger.prototype.i = function(tag, message, data) {
  this.print(tag, message, LogLevel.info, data);
}

/**
 * Logs a warning message
 * @param {tag} string Who logs the message
 * @param {message} string Message to be logged
 */
Logger.prototype.w = function(tag, message) {
  this.print(tag, message, LogLevel.warn);
}

/**
 * Logs a debug message
 * @param {tag} string Who logs the message
 * @param {message} string Message to be logged
 */
Logger.prototype.d = function(tag, message) {
  this.print(tag, message, LogLevel.debug);
}

/**
 * Logs a debug message with data
 * @param {tag} string Who logs the message
 * @param {message} string Message to be logged
 * @param {data} object Data to be logged
 */
Logger.prototype.d = function(tag, message, data) {
  this.print(tag, message, LogLevel.debug, data);
}

/**
 * Logs a verbose message
 * @param {tag} string Who logs the message
 * @param {message} string Message to be logged
 */
Logger.prototype.v = function(tag, message) {
  this.print(tag, message, LogLevel.verbose);
}

module.exports = Logger;