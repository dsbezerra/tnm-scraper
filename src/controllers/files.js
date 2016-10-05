var cheerio = require('cheerio');
var fetch = require('node-fetch');
var uuid = require('node-uuid');
var _ = require('lodash');

var fileutils = require('../utils/fileutils');
var networkutils = require('../utils/networkutils');
var Decompressor = require('../decompressor');
var FtpUploader = require('../network/ftpuploader');

/**
 * Process a file and convert to pdf or uncompress
 */
exports.process = (req, res) => {
  var body = req.body;

  if (body) {
    var id = body.id,
        uri = body.uri,
        filename = body.filename,
        format = body.format;
          
    // If we have a link download first
    if (uri && format) {
      var randomName = uuid.v1() + '.' + format;
      var destPath = './data/' + randomName;

      networkutils.downloadFile(uri, destPath, function(err) {
        if (err) {
          return res.status(500)
            .send({
              message: err.message,
              code: err.code
            });
        }

        if (isCompressed(format)) {
          var decompressor = new Decompressor(destPath);
          decompressor.exec(function(err, decompressed) {
            if (!err) {
              var possibleEdital = -1;
              var response = {
                id: decompressed.id,
                filenames: _.map(decompressed.filepaths, function(filepath, index) {
                  if(filepath.toLowerCase().indexOf('edital') > -1) {
                    possibleEdital = index;
                  }
                  return fileutils.getNameFromPath(filepath, true);
                }),
                possiblePdf: possibleEdital
              }

              return res.send(response);
            } 
            else {
              return res.status(500)
                .send({
                  message: err.message,
                  code: err.code
                });
            }

          });
        } 
        else if (isWordDocument(format)) {
          convertToPDF(destPath, function(err, file) {
            if(err) return res.send(err);
            else {
              uploadToHostgator(file, function(err, result) {
                if(err) return res.status(500).send(err);
                else {
                  fileutils.removeFile(destPath);
                  return res.send(result);
                }
              });
            }
          });
        }
        else {
          // TODO(diego): Add support to ODT
          return res.send({
            success: false,
            message: 'File format not supported!'
          });
        }
      });
    }
    // If we already have this file extracted
    else if(id && filename && format) {
      var path = 'data/tmp/' + id + '/' + filename + '.' + format;
      if(isWordDocument(format)) {
        convertToPDF(path, function(err, file) {
          if(err) return res.send(err);
          else {
            uploadToHostgator(file, function(err, result) {
              if(err) return res.status(500).send(err);
              else {
                fileutils.removeDirectory('data/tmp/' + id);
                return res.send(result);
              }
            });
          }
        });
      }
      else if (isPDFDocument(format)) {
        var path = 'data/tmp/' + id + '/' + filename + '.' + format;
        var buffer = fileutils.readFile(path);
        if(buffer) {
          var file = { name: filename, format: format, buffer: buffer };
          uploadToHostgator(file, function(err, result) {
            if(err) return res.status(500).send(err);
            else {
              fileutils.removeDirectory('data/tmp/' + id);
              return res.send(result);
            }
          });
        }
        else {
          return res.status(404).send({
            success: false,
            message: 'Couldn\'t find this file!'
          });
        }
      }
      else {
        // TODO(diego): Add support to ODT
        return res.status(500).send({
          success: false,
          message: 'File format not supported!'
        });
      }
      
    }
    else {
      // TODO(diego): Handle param missing.
    }
    
  } 
  else {
    console.log('No body');
    return res.status(204).send('');
  }
}

function uploadToHostgator(file, callback) {
  var ftpUploader = new FtpUploader('http://tnmlicitacoes.com/files/');
  
  const HOSTGATOR_FOLDER_NAME =
                   process.env.NODE_ENV === 'production' ? 'editais' : 'stream';
  
  ftpUploader.put(file, HOSTGATOR_FOLDER_NAME, function(err, result) {
    if(err) return callback(err);
    else {
      return callback(null, result);
    }
  });
}

function convertToPDF(filepath, callback) {
  if(!filepath) return;
  
  console.log('Converting word document to pdf...');
  
  var uri = 'http://mirror1.convertonlinefree.com';
  fetch(uri)
    .then(function(res) {
      return res.text();
    })
    .then(function(body) {
      var $ = cheerio.load(body);
      var __VIEWSTATE = $('#__VIEWSTATE').val();
      var __VIEWSTATEGENERATOR = $('#__VIEWSTATEGENERATOR').val();
      
      var FormData = require('form-data');
      var form = new FormData();
      form.append('__EVENTTARGET', '');
      form.append('__EVENTARGUMENT', '');
      form.append('__VIEWSTATE', __VIEWSTATE);
      form.append('__VIEWSTATEGENERATOR', __VIEWSTATEGENERATOR);
      
      var buffer = fileutils.readFile(filepath);
      var filename = fileutils.getNameFromPath(filepath, false);
      
      form.append('ctl00$MainContent$fu', buffer, { 
                    filename: filename,
                    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      
      form.append('ctl00$MainContent$btnConvert', 'Convert');
      form.append('ctl00$MainContent$fuZip', '');
      
      // POST to convert
      fetch(uri, { method: 'POST', body: form })
        .then(function(res) {
          return res.buffer();
        })
        .then(function(body) {
          console.log('Conversion finished.');
          return callback(null, {
            name: filename,
            format: 'pdf',
            buffer: body,
        })
        .catch(function(err) {
          return callback(err);
        });
      });  
    })
    .catch(function(err) {
      return callback(err);
    });
}

/**
 * Check if is a compressed format
 */
function isCompressed(format) {
  return format === 'zip' || format === 'rar';
}

/**
 * Check if is a word document
 */
function isWordDocument(format) {
  return format === 'doc' || format === 'docx';
}
 
/**
 * Check if is a pdf document
 */
function isPDFDocument(format) {
  return format === 'pdf';
}