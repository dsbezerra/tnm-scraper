'use strict';

var cheerio             = require('cheerio');
var objectAssign        = require('object-assign');
var request             = require('request');

var extractNotice       = require('./extraction/extractNotice');

function TaskTest(options) {

  var self = this;

  self.testURL = null;
  self.page = null;
  self.config = null;

  self.onFinish = null;
  self.onError = null;

  self.type = null;
  self.result = null;

  self.init(options);
}

TaskTest.prototype.init = function(options) {

  var self = this;
  
  if (options.taskType === 'GET_LINKS') {
    self.type = options.taskType;
  }
  else if (options.taskType === 'GET_DETAILS') {
    self.type = options.taskType;
  }
  else {
    throw new Error('Invalid task.');
  }

  if (options.config) {
    self.config = options.config;
  }
  
  if (options.testURL) {
    self.testURL = options.testURL;
  }

  if (options.onFinish) {
    self.onFinish = options.onFinish;
  }
  
  if (self.testURL) {
    requestPage(self, onRequestPageFinished);
  }
}

function requestPage (taskTest, finishCallback) {
  
  var options = {
    method: 'GET',
    url: taskTest.testURL,
  };
  
  request(options, function(err, response, body) {
    if (!err && response.statusCode === 200) {
      //
      // Decode body first?
      //
      taskTest.page = cheerio.load(body);
    }

    //
    // Callback to begin testing selectors and patterns
    //
    finishCallback && finishCallback(taskTest);
  });
}

function onRequestPageFinished(taskTest) {

  if (taskTest.page) {
    // Handle each type of task here

    var type = taskTest.type;
    
    if (type === 'GET_LINKS') {
      handleGetLinksTask(taskTest);
    }
    else if (type === 'GET_DETAILS') {
      handleGetDetailsTask(taskTest);
    }
    else {
      // Do nothing
    }
  }
  else {
    
  }
}

function handleGetLinksTask() {
  console.log('handleGetLinksTask');
}

function handleGetDetailsTask(taskTest) {
 
  var config = taskTest.config;
  var result = extractNotice(taskTest.page, config.selectors, config.patterns, null);

  if (result) {
    taskTest.result = result;
    taskTest.onFinish && taskTest.onFinish(null, result);
  }
  else {
    taskTest.onFinish && taskTest.onFinish(
      new Error('Couldn\'t extract notice with this configuration.')
    );
  }
}

function testTask(testURL, taskType, config, finishCallback) {

  if (!testURL) {
    // TODO(diego): Log error;
    return;
  }

  var options = {};

  options = objectAssign(options, {
    testURL: testURL,
    taskType: taskType,
    config: config,
    onFinish: finishCallback,
  });

  return new TaskTest(options);
}


var taskTest = testTask(
  'http://e-negocioscidadesp.prefeitura.sp.gov.br/DetalheLicitacao.aspx?l=9VP%2fUsQUNEs%3d',
  'GET_DETAILS',
  {
    "selectors": {
      "modality": "#ctl00_cphConteudo_frmDetalheLicitacao_lblModalidade",
      "agency": "#ctl00_cphConteudo_frmDetalheLicitacao_lblOrgao",
      "number": "#ctl00_cphConteudo_frmDetalheLicitacao_lblNumeroPublicacao",
      "openDate": "#ctl00_cphConteudo_frmDetalheLicitacao_lblAberturaSessao",
      "publishDate": "#ctl00_cphConteudo_frmDetalheLicitacao_lblDataPublicacao",
      "description": "#ctl00_cphConteudo_frmDetalheLicitacao_lblObjeto",
      "link": "#ctl00_cphConteudo_frmDetalheLicitacao_lnkDownloadEdital"
    },
    "patterns": {
      "openDate": "\\d{2}\/\\d{2}\\/\\d{4}",
      "publishDate": "\\d{2}\/\\d{2}\\/\\d{4}"
    }
  }, function(err, result) {
    console.log(result);
  }
);

