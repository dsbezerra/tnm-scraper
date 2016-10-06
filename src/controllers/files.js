var cheerio = require('cheerio');
var fetch = require('node-fetch');
var uuid = require('node-uuid');
var _ = require('lodash');

var fileutils = require('../utils/fileutils');
var networkutils = require('../utils/networkutils');
var Decompressor = require('../decompressor');
var FtpUploader = require('../network/ftpuploader');

var tasksProgress = {};

var RESULT_CODE = {
  NONE: 0,
  
  ERROR_CONVERT_PDF:      501,
  ERROR_UPLOAD_FTP:       502,
  ERROR_EXTRACTION:       503,
  ERROR_DOWNLOAD:         504,
  ERROR_FILE_NOT_FOUND:   505,
  ERROR_UNSUPPORTED_FILE: 506,
  
  
  SUCCESS_CONVERT_PDF:    201,
  SUCCESS_UPLOAD_FTP:     202,
  SUCCESS_EXTRACTION:     203,
  SUCCESS_DOWNLOAD:       204,
}

//
// TODO(diego): Create ENUMS for error codes, remove hard coded strings, etc.
//

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

    var taskId = uuid.v1();

    updateTask(taskId, {
      running: true,
      code: RESULT_CODE.NONE,
      message: 'Processando arquivo...'
    });
    res.send({
      success: true,
      taskId: taskId
    });

    // If we have a link download first
    if (uri && format) {

      var randomName = uuid.v1() + '.' + format;
      var destPath = './data/' + randomName;

      updateTask(taskId, {
        message: 'Baixando arquivo...'
      });

      networkutils.downloadFile(uri, destPath, function(err) {
        if (err) {
          updateTask(taskId, {
            running: false,
            code: RESULT_CODE.ERROR_DOWNLOAD
          });
        }

        updateTask(taskId, {
          code: RESULT_CODE.SUCCESS_DOWNLOAD,
          message: 'Arquivo baixado.'
        });

        if (isCompressed(format)) {
          var decompressor = new Decompressor(destPath);
          updateTask(taskId, {
            message: 'Extraindo arquivo...'
          });
          decompressor.exec(function(err, decompressed) {
            if (!err) {
              var possibleEdital = -1;
              var response = {
                id: decompressed.id,
                filenames: _.map(decompressed.filepaths, function(filepath, index) {
                  if (filepath.toLowerCase().indexOf('edital') > -1) {
                    possibleEdital = index;
                  }
                  return fileutils.getNameFromPath(filepath, true);
                }),
                possiblePdf: possibleEdital
              }

              updateTask(taskId, {
                running: false,
                code: RESULT_CODE.SUCCESS_EXTRACTION,
                message: 'Extração finalizada com sucesso!',
                data: response
              });
            } else {
              updateTask(taskId, {
                running: false,
                code: RESULT_CODE.ERROR_EXTRACTION
              });
            }
          });
        } else if (isWordDocument(format)) {
          updateTask(taskId, {
            message: 'Convertendo para PDF...'
          });
          convertToPDF(destPath, function(err, file) {
            if (err)
              updateTask(taskId, {
                running: false,
                code: RESULT_CODE.ERROR_CONVERT_PDF,
                message: 'Falha ao converter para PDF!'
              });
            else {
              updateTask(taskId, {
                code: RESULT_CODE.SUCCESS_CONVERT_PDF,
                message: 'Upando para o hostgator...'
              });
              uploadToHostgator(file, function(err, result) {
                if (err)
                  updateTask(taskId, {
                    running: false,
                    code: RESULT_CODE.ERROR_UPLOAD_FTP,
                    message: 'Falha ao enviar para o Hostgator!'
                  });
                else {
                  fileutils.removeFile(destPath);
                  updateTask(taskId, {
                    running: false,
                    code: RESULT_CODE.SUCCESS_UPLOAD_FTP,
                    message: 'Upload finalizado!',
                    data: result
                  });
                }
              });
            }
          });
        } else {
          // TODO(diego): Add support to ODT
          updateTask(taskId, {
            running: false,
            code: RESULT_CODE.ERROR_FILE_NOT_FOUND,
            message: 'Formato não suportado!'
          });
        }
      });
    }
    // If we already have this file extracted
    else if (id && filename && format) {
      var path = 'data/extracted_tmp/' + id + '/' + filename + '.' + format;
      if (isWordDocument(format)) {
        updateTask(taskId, {
          code: RESULT_CODE.NONE,
          message: 'Convertendo para PDF...'
        });
        convertToPDF(path, function(err, file) {
          if (err)
            updateTask(taskId, {
              running: false,
              code: RESULT_CODE.ERROR_CONVERT_PDF,
              message: 'Falha ao converter para PDF!'
            });
          else {
            updateTask(taskId, {
              code: RESULT_CODE.SUCCESS_CONVERT_PDF,
              message: 'Upando para o hostgator...'
            });
            uploadToHostgator(file, function(err, result) {
              if (err)
                updateTask(taskId, {
                  running: false,
                  code: RESULT_CODE.ERROR_UPLOAD_FTP,
                  message: 'Falha ao enviar para o Hostgator!'
                });
              else {
                fileutils.removeDirectory('data/extracted_tmp/' + id);
                updateTask(taskId, {
                  running: false,
                  code: RESULT_CODE.SUCCESS_UPLOAD_FTP,
                  message: 'Upload finalizado!',
                  data: result
                });
              }
            });
          }
        });
      } else if (isPDFDocument(format)) {
        var path = 'data/extracted_tmp/' + id + '/' + filename + '.' + format;
        var buffer = fileutils.readFile(path);
        if (buffer) {
          var file = {
            name: filename,
            format: format,
            buffer: buffer
          };
          updateTask(taskId, {
            message: 'Upando para o hostgator...'
          });
          uploadToHostgator(file, function(err, result) {
            if (err)
              updateTask(taskId, {
                running: false,
                code: RESULT_CODE.ERROR_UPLOAD_FTP,
                message: 'Falha ao enviar para o Hostgator!'
              });
            else {
              fileutils.removeDirectory('data/extracted_tmp/' + id);
              updateTask(taskId, {
                running: false,
                code: RESULT_CODE.SUCCESS_UPLOAD_FTP,
                message: 'Upload finalizado!',
                data: result
              });
            }
          });
        } else {
          updateTask(taskId, {
            running: false,
            code: RESULT_CODE.ERROR_FILE_NOT_FOUND,
            message: 'Não foi possível encontrar o arquivo!'
          });
        }
      } else {
        // TODO(diego): Add support to ODT
        updateTask(taskId, {
          running: false,
          code: RESULT_CODE.ERROR_UNSUPPORTED_FILE,
          message: 'Formato não suportado!'
        });
      }

    } else {
      // TODO(diego): Handle param missing.
    }

  } else {
    console.log('No body');
    return res.status(204).send('');
  }
}

exports.checkProgress = (req, res) => {
  if(req.body) {
    var id = req.body.id;
    var response = tasksProgress[id];
    
    if(response) {
      if(!response.running) {
        delete tasksProgress[id];
      } 
      
      return res.send(response);
    }
    else {
      return res.send({
        success: true,
        message: 'Nenhum processo em execução.'
      })
    }
  }
  else {
    return res.status(500).send({
      success: false,
      message: '\'id\' param is missing.'
    })
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
  if (!filepath) return;

  console.log('Converting word document to pdf...');

  var uri = 'http://mirror1.convertonlinefree.com';
  fetch(uri)
    .then(function(res) {
      return res.text();
    })
    .then(function(body) {

      var buffer = fileutils.readFile(filepath);
      var filename = fileutils.getNameFromPath(filepath, false);

      if (buffer && filename) {
        var $ = cheerio.load(body);
        var __VIEWSTATE = $('#__VIEWSTATE').val();
        var __VIEWSTATEGENERATOR = $('#__VIEWSTATEGENERATOR').val();

        var FormData = require('form-data');
        var form = new FormData();
        form.append('__EVENTTARGET', '');
        form.append('__EVENTARGUMENT', '');
        form.append('__VIEWSTATE', __VIEWSTATE);
        form.append('__VIEWSTATEGENERATOR', __VIEWSTATEGENERATOR);
        form.append('ctl00$MainContent$fu', buffer, {
          filename: filename,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

        form.append('ctl00$MainContent$btnConvert', 'Convert');
        form.append('ctl00$MainContent$fuZip', '');

        // POST to convert
        fetch(uri, {
            method: 'POST',
            body: form
          })
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
          })
          .catch(function(err) {
            return callback(err);
          })
      } else {
        return callback({
          message: 'Buffer is null!'
        });
      }
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

function updateTask(taskId, data) {
  tasksProgress[taskId] = Object.assign(tasksProgress[taskId] ? 
                                        tasksProgress[taskId] : {}, data);
} 