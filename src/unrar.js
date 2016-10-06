'use strict'

var uuid = require('node-uuid');
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var exec = child_process.exec;
var spawnSync = child_process.spawnSync;

var fileutils = require('./utils/fileutils');

/**
 * Wrapper for command-line unrar
 */

var CURRENT_WORKING_DIR = process.cwd() + '/';
var UNRAR_PATH = CURRENT_WORKING_DIR + 'thirdparty/rar/unrar';
var TMP_PATH = CURRENT_WORKING_DIR + 'data/extracted_tmp';

function UnRAR(path) {

  if (!path) {
    throw new Error('Path is invalid!');
  }

  if (typeof path !== 'string') {
    throw new Error('Path must be a string!');
  }

  if (!path.toLowerCase().endsWith('.rar')) {
    throw new Error('Invalid file format!');
  }

  var self = this;

  self.filePath = CURRENT_WORKING_DIR + path;

  if (!fileutils.exists(TMP_PATH))
    fileutils.createDirectory(TMP_PATH);

  fs.chmodSync(UNRAR_PATH, 777);
  fs.chmodSync(CURRENT_WORKING_DIR + 'data', 777);

  return self;
}

/**
 * Extracts all contents inside .rar file to a random destination path
 * COMMAND > unrar e -ai path dest_path
 *  e         - Extract contents <command>
 * -ai        - Ignore file attributes [switch]
 * path       - Path to file to be extracted
 * dest_path  - Destination path of extracted files
 */
UnRAR.prototype.extract = function(callback) {
  var self = this;

  if (self.filePath) {

    var name = fileutils.getNameFromPath(self.filePath);
    var result = fileutils.createDirectoryAt(TMP_PATH, name, false);

	var COMMAND = 'e -ai ' + self.filePath + ' ' + result.destPath;
    var child = exec(UNRAR_PATH + COMMAND, function(error, stdout, stderr) {
      if (error) {
        console.error('exec error: ' + error);
        return callback(error);
      }
    });

    // Close event
    child.on('close', function(code) {
      
      fileutils.removeFile(self.filePath);
      
      switch (code) {
        // Success
        case 0:
          {
            var filepaths = fileutils.getFilePathsFromDirectory(result.destPath);
            result.filepaths = filepaths;
            return callback(null, result);
          }

        default:
          console.log(code);
      }
    });
  } else {
    return callback(new Error('File path is invalid!'));
  }
}

/**
 * Synchronous version of UnRAR.extract
 */
UnRAR.prototype.extractSync = function() {
  var self = this;

  if (self.filePath) {
    var name = fileutils.getNameFromPath(self.filePath);
    var result = fileutils.createDirectoryAt(TMP_PATH, name, false);
    var child = spawnSync(UNRAR_PATH, ['e', '-ai', self.filePath, result.destPath]);
    
    fileutils.removeFile(self.filePath);

    if (child.status === 0) {
      console.log('Success!');
      var filepaths = fileutils.getFilePathsFromDirectory(result.destPath);
      result.filepaths = filepaths;
      return result;
    } else {
      console.log(child.stdout);
    }
  }
}

module.exports = UnRAR;