var ftpClient = require('ftp');
var secrets = require('../../config/secrets');
var uid2 = require('uid2');

function FtpUploader(options) {

  var self = this;

  if(typeof options === 'string') {
    self.rootUri = options;
    options = null;
  }
  
  if(!options) {
    options = {
      credentials: secrets.ftp,
      randomName: true
    };
  }

  self.options = options;
  self.ftpClient = null;
  
  return self.init(options);
}

FtpUploader.prototype.init = function(options) {

  var self = this;
  
  self.ftpClient = new ftpClient();

  var client = self.ftpClient;
  
  client.on('ready', function() {
    return client;
  });

  client.connect(options.credentials);
}

FtpUploader.prototype.put = function(file, path, callback) {

  var self = this;

  if(!path) {
    return callback(new Error('Path must be specified!'));
  }

  if(!file) {
    return callback(new Error('File is not valid!'));
  }
  
  var data = file.buffer || file.stream;
  if(!data) {
    return callback(new Error('File data is invalid!'));
  }

  var client = self.ftpClient;

  var fileName = file.name;
  var fileFormat = file.format;
  
  if(!fileName || self.options.randomName) {
    fileName = uid2(32) + '.' + fileFormat;
  }  

  if(path.endsWith('/')) {
    path += fileName;
  }
  else {
    path += '/' + fileName;
  }
  
  client.put(data, path, function(err) {
    if(!err) {
      client.end();

      return callback(null, {
        success: true,
        data: {
          fileName: fileName,
          fileFormat: fileFormat,
          fileUri: self.rootUri + path
        }
      });
    }

    return callback(new Error('Oops.. something is wrong...'));
  });
}

module.exports = FtpUploader;