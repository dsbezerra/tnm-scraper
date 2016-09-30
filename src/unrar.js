const uuid = require('node-uuid');
const fs   = require('fs');
const path = require('path');
const child_process = require('child_process');
const exec = child_process.exec;
const execSync = child_process.execSync;

const fileutils = require('./utils/fileutils');

/**
 * Wrapper for command-line unrar
 */
 
const CURRENT_WORKING_DIR = process.cwd() + '/';
const UNRAR_PATH = CURRENT_WORKING_DIR + 'thirdparty/rar/unrar';
const TMP_PATH = CURRENT_WORKING_DIR + 'data/tmp';

function UnRAR(path) {

  if(!path) {
    throw new Error('Path is invalid!');
  }

  if(typeof path !== 'string') {
    throw new Error('Path must be a string!');
  }

  var self = this;
  
  self.filePath = CURRENT_WORKING_DIR + path;
  
  if(!fileutils.exists(TMP_PATH))
    fileutils.createDirectory(TMP_PATH);
    
  fs.chmodSync(UNRAR_PATH, 0o777);

  return self;
}

/**
 * Extracts all contents inside .rar file to a random destination path
 * COMMAND > unrar e -al -cl path dest_path
 *  e         - Extract contents <command>
 * -al        - Ignore file attributes [switch]
 * -cl        - Convert filenames to lower case [switch]
 * path       - Path to file to be extracted
 * dest_path  - Destination path of extracted files
 */
UnRAR.prototype.extract = function(callback) {
  var self = this;

  if(self.filePath) {

    var result = createRandomTmpFolder();
    
    const COMMAND = ` e -ai -cl ${self.filePath} ${result.destPath}`;
    exec(UNRAR_PATH + COMMAND, function(error, stdout, stderr) {
      if (error) {        
        console.error(`exec error: ${error}`);
        return callback(error);
      }
      
      if(isAllOK(stdout)) {
        const filenames = fileutils.getFilenamesFromDirectory(result.destPath);
        result.filenames = filenames;
        return callback(null, result);
      }
      
      console.log(stdout);
      return callback(new Error('Some files couldn\'t be extracted!'));
    });
  }
  else {
    return callback(new Error('File path is invalid!'));
  }
}

/**
 * Synchronous version of UnRAR.extract
 */
UnRAR.prototype.extractSync = function() {
  var self = this;
  
  if(self.filePath) {
    var result = createRandomTmpFolder();
    const COMMAND = ` e -ai -cl ${self.filePath} ${result.destPath}`;
    const stdout = execSync(UNRAR_PATH + COMMAND);
    
    if(isAllOK(stdout)) {
      const filenames = fileutils.getFilenamesFromDirectory(result.destPath);
      result.filenames = filenames;
      return result;
    }
    
    console.log(stdout);
  }
}

/**
 * Check if the given output is OK
 */
function isAllOK(stdout) {
  return stdout.indexOf('All OK') > -1;
}

/**
 * Creates a random temporary random folder
 */
function createRandomTmpFolder() {
  const folderName = uuid.v1();
  const destPath = TMP_PATH + '/' + folderName;
  
  if(!fileutils.isDirectory(destPath))
      fileutils.createDirectory(destPath);
  
  return {
    id: folderName,
    destPath: destPath
  };
}

module.exports = UnRAR;