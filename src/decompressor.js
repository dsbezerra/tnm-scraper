'use strict'

var UnRAR = require('./unrar');
var UnZIP = require('./unzip');

function Decompressor(path) {
  var self = this;

  if (!path || typeof path !== 'string') {
    throw new Error('\'path\' must be valid!');
  }

  self.path = null;
  self.extension = null;

  self.decompressed = null;

  self.init(path);

  return self;
}

Decompressor.prototype.init = function(path) {
  var self = this;

  if (path.endsWith('.zip'))
    self.extension = 'zip';
  else if (path.endsWith('.rar'))
    self.extension = 'rar';
  else
    throw new Error('Invalid file extension!');

  self.path = path;
  self.decompressed = [];
}

Decompressor.prototype.exec = function(callback) {
  var self = this;

  var process = null;

  console.log('Beginning extraction of ' + self.path);

  switch (self.extension) {
    case 'rar':
    {
      process = new UnRAR(self.path);
    }
    break;
    case 'zip':
    {
      process = new UnZIP(self.path);
    }
    break;
  }

  if (process) {
    console.log('Extraction finished successfully!');
    
    if (typeof callback === 'function') {
      process.extract(function(err, decompressed) {
        if (err) return callback(err);
        else self.decompressed.push(decompressed);
        
        console.log('Destination path is: ' + decompressed.destPath);
        
        return callback(null, decompressed);
      });
    }
    else {
      var decompressed = process.extractSync();
      self.decompressed.push(decompressed);
      console.log('Destination path is: ' + decompressed.destPath);
      return decompressed;
    }
  }
}

/**
 * Get array with decompressed files info
 * @return {object} Array with decompressed files info
 */
Decompressor.prototype.getDecompressed = function() {
  return this.decompressed;
}

/**
 * Set the path where compressed file is located
 * @param {String} path Path to compressed file
 * @return {undefined} Nothing
 */
Decompressor.prototype.setPath = function(path) {
  if(path) this.init(path);
}

module.exports = Decompressor;