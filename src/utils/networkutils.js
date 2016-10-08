var fs = require('fs');

require('es6-promise').polyfill();
require('isomorphic-fetch');

function download(uri, path, file, callback) {
  if(!uri)
    return null;
    
  fetch(uri)
    .then(function(res) {
      if(file && path) {
        var dest = fs.createWriteStream(path);
        dest.on('close', function() {
          if(callback) {
            return callback(null, dest.path);
          }
          console.log('Download finished.');
        });
        
        console.log('Downloading...');
        res.body.pipe(dest);
      }
    });
}

function downloadFile(uri, path, callback) {
  return download(uri, path, true, callback);
}

exports.downloadFile = downloadFile;
