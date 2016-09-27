const fs   = require('fs');
const path = require('path');
const exec = require('child_process').exec;

/**
 * Wrapper for command-line unrar
 */

const UNRAR_PATH = path.resolve('./', 'thirdparty/rar/unrar');
const TMP_PATH = './data/tmp';


const CURRENT_WORKING_DIR = process.cwd();
console.log(CURRENT_WORKING_DIR);

function UnRAR(path) {

  if(!path) {
    throw new Error('Path is invalid!');
  }

  if(typeof path !== 'string') {
    throw new Error('Path must be a string!');
  }

  var self = this;
  
  self.filePath = path;

  return self;
}

UnRAR.prototype.extract = function(callback) {
  var self = this;

  if(self.filePath) {
    const unrarCommand = ` e ${self.filePath} ${TMP_PATH}`;
    fs.chmodSync(UNRAR_PATH, 0777);

    exec(UNRAR_PATH + unrarCommand, function(error, stdout, stderr) {
      if (error) {        
        console.error(`exec error: ${error}`);
        return callback(error);
      }

      console.log(`stdout: ${stdout}`);
      console.log(`stderr: ${stderr}`);
    });

  }
}

module.exports = UnRAR;