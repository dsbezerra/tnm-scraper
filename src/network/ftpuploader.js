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
  self.client = null;
  
  return self.init(options);
}

FtpUploader.prototype.init = function(options) {

  var self = this;
  
  self.client = new ftpClient();
  self.client.connect(options.credentials);
  return self;
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

  var client = self.client;

  var fileName = file.name;
  var fileFormat = file.format;
  
  if(!fileName || self.options.randomName) {
    fileName = uid2(32) + '.' + fileFormat;
  }  

  if(endsWith(path, '/')) {
    path += fileName;
  }
  else {
    path += '/' + fileName;
  }
  
  client.put(data, path, function(err) {
    if(!err) {
      client.end();

      return callback(null, {
        fileName: fileName,
        fileFormat: fileFormat,
        uri: self.rootUri + path
      });
    }

    return callback(new Error('Oops.. something is wrong...'));
  });
}

function endsWith(strA, strB) {
	return new RegExp(strB + "$").test(strA);
}

module.exports = FtpUploader;