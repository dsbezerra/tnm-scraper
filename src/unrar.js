const path = require('path');
const exec = require('child_process').exec;

/**
 * Wrapper for command-line unrar
 */

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
    const unrarPath = 'thirdparty/rar/unrar ';
    const unrarCommand = `x ${self.filePath}`;
    
    exec(path.resolve('../', unrarPath + unrarCommand), function(error, stdout, stderr) {
      if (error) {
        console.error(`exec error: ${error}`);
        return callback(errr);
      }

      console.log(`stdout: ${stdout}`);
      console.log(`stderr: ${stderr}`);
    });
  }
}

module.exports = UnRAR;