'use strict'

var uuid = require('node-uuid');
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var exec = child_process.exec;
var spawnSync = child_process.spawnSync;

var encoding = require("encoding");

var fileutils = require('./utils/fileutils');

/**
 * Wrapper for command-line unzip
 */

var CURRENT_WORKING_DIR = process.cwd() + '/';
var DATA_DIR = CURRENT_WORKING_DIR + 'data/';						  
var TMP_DIR = DATA_DIR + 'extracted_tmp/';
											  
function UnZIP(path) {

  if (!path) {
    throw new Error('Path is invalid!');
  }

  if (typeof path !== 'string') {
    throw new Error('Path must be a string!');
  }

  if (!endsWith(path.toLowerCase(), '.zip')) {
    throw new Error('Invalid file format!');
  }

  var self = this;

  
  self.filePath = path;

  if (!fileutils.exists(TMP_DIR))
    fileutils.createDirectory(TMP_DIR);
  
  /*fs.chmodSync(DATA_DIR, 777);
  fs.chmodSync(TMP_DIR, 777);*/

  return self;
}

/**
 * Extracts all contents inside .zip file to a random destination path
 * COMMAND > unzip -UU file_path -d dest_path
 * filePath   - Zip file path
 * -d         - Used to define an destination directory
 * dest_path  - Destination path of extracted files
 */
UnZIP.prototype.extract = function(callback) {
  var self = this;

  if (self.filePath) {
    
    var name = fileutils.getNameFromPath(self.filePath);
    var result = fileutils.createDirectoryAt(TMP_DIR, name, false);
	
  	var COMMAND = 'unzip ' + self.filePath + ' -d ' + result.destPath;
      var child = exec(COMMAND, function(error, stdout, stderr) {
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
            var filepaths = fileutils.getFilePathsFromDirectory(result.destPath, true);
            result.filepaths = filepaths;
            return callback(null, result);
          }

        default:
          console.log(code);
      }
    });
  }
}

/**
 * Synchronous version of UnZIP.extract
 */
UnZIP.prototype.extractSync = function(callback) {
  var self = this;

  if (self.filePath) {
    var name = fileutils.getNameFromPath(self.filePath);
    var result = fileutils.createDirectoryAt(TMP_DIR, name, false);
    var child = spawnSync('unzip', [self.filePath, '-d', result.destPath]);

    fileutils.removeFile(self.filePath);

    if (child.status === 0) {
      console.log('Success!');
      var filepaths = fileutils.getFilePathsFromDirectory(result.destPath, true);
      result.filepaths = filepaths;
      return result;
    } else {
      console.log(child.stdout);
    }
  }
}

function endsWith(strA, strB) {
	return new RegExp(strB + "$").test(strA);
}

module.exports = UnZIP;