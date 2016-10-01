const uuid = require('node-uuid');
const fs   = require('fs');
const path = require('path');
const child_process = require('child_process');
const exec = child_process.exec;
const spawnSync = child_process.spawnSync;

const fileutils = require('./utils/fileutils');

/**
 * Wrapper for command-line unzip
 */
 
const CURRENT_WORKING_DIR = process.cwd() + '/';
const TMP_PATH = CURRENT_WORKING_DIR + 'data/tmp';

function UnZIP(path) {

  if(!path) {
    throw new Error('Path is invalid!');
  }

  if(typeof path !== 'string') {
    throw new Error('Path must be a string!');
  }
  
  if(!path.toLowerCase().endsWith('.zip')) {
    throw new Error('Invalid file format!');
  }

  var self = this;
  
  self.filePath = CURRENT_WORKING_DIR + path;
  
  if(!fileutils.exists(TMP_PATH))
    fileutils.createDirectory(TMP_PATH);

  return self;
}

/**
 * Extracts all contents inside .zip file to a random destination path
 * COMMAND > unzip file_path -d dest_path
 * filePath   - Zip file path
 * -d         - Used to define an destination directory
 * dest_path  - Destination path of extracted files
 */
UnZIP.prototype.extract = function(callback) {
  var self = this;
  
  if(self.filePath) {
    var result = fileutils.createRandomDirectoryAt(TMP_PATH);
    
    const COMMAND = `unzip ${self.filePath} -d ${result.destPath}`;
    var child = exec(COMMAND, function(error, stdout, stderr) {
      if(error) {
        console.error(`exec error: ${error}`);
        return callback(error);
      }
    });
    
    // Close event
    child.on('close', function(code) {
      switch(code) {
        // Success
        case 0:
        {
          const filenames = fileutils.getFilenamesFromDirectory(result.destPath);
          result.filenames = filenames;
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
  
  if(self.filePath) {
    var result = fileutils.createRandomDirectoryAt(TMP_PATH);
    var child = spawnSync('unzip', [self.filePath, '-d', result.destPath]);
    
    if(child.status === 0) {
      console.log('Success!');
      const filenames = fileutils.getFilenamesFromDirectory(result.destPath);
      result.filenames = filenames;
      return result;
    }
    else {
      console.log(child.stdout);
    }
  }
}

module.exports = UnZIP;