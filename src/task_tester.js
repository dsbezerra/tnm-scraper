'use strict';

var cheerio             = require('cheerio');
var objectAssign        = require('object-assign');
var request             = require('request');
var iconv               = require('iconv-lite');

var resolveLinks           = require('./link_resolver').resolveLinks;

var extractMinimumContent  = require('./extraction/extractMinimumContent');
var extractNotice          = require('./extraction/extractNotice');
var extractText            = require('./extraction/extractText');

var getAspNetFormData      = require('./extraction/getAspNetFormData');

function TaskTest(options) {

  var self = this;

  self.testURL = null;

  self.page = {
    // Response body from request
    body: null,
    // Loaded HTML cheerio
    loaded: null,
    // Always store the last url
    currentURI: null,
  };

  self.request = null;

  self.aspNetForm = null;
  
  self.config = null;

  self.onFinish = null;
  self.onError = null;

  self.type = null;
  self.result = null;

  self.init(options);
}

TaskTest.prototype.init = function(options) {

  var self = this;

  console.log('Initializing task test...');
  
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

  console.log('TESTING URL: %s\nTASK TYPE: %s\nASP.NET: %s', self.testURL, self.type, self.config.aspnet);
  
  if (self.testURL) {
    requestPage(self, onRequestPageFinished);
  }
}


function requestPage (taskTest, finishCallback) {

  var config = taskTest.config;

  var options = {};

  if (config.request) {
    options.url = taskTest.testURL;
    options.method = config.request.method || 'GET';
    options.form = config.request.form || {};  
  }

  var requestDefaults = {
    jar: true,
    followAllRedirects: true,
  };

  if (config.charset) {
    requestDefaults.encoding = null;
  }
  
  taskTest.request = request.defaults(requestDefaults);

  if (config.aspnet && !taskTest.aspNetForm) {

    console.log('Getting ASP.NET form data.');
    
    //
    // If we need to get all aspnet form parameters
    //
    taskTest.request({
      url: taskTest.testURL,
      method: 'GET',
    }, function(err, response, body) {
      if (!err && response.statusCode === 200) {
        var $ = cheerio.load(body);
        taskTest.aspNetForm = getAspNetFormData($);

        //
        // Now that we have the values, call again requestPage so we can do the main request
        //
        requestPage(taskTest, finishCallback);
      }
      else {
        console.log(err);
      }
      
    });
    
  }
  else {

    //
    // If we have aspnet form params, merge with options form object
    //
    if (taskTest.aspNetForm) {
      objectAssign(options.form, taskTest.aspNetForm);
    }

    console.log('Requesting test page...');
    taskTest.request(options, function(err, response, body) {
      if (!err && response.statusCode === 200) {
        
        taskTest.page.currentURI = response.request.href;
        taskTest.page.body = body;
        
        if (config.charset) {  
          taskTest.page.loaded = cheerio.load(iconv.decode(body, 'iso-8859-1'), {
            decodeEntities: false
          });  
          
          console.log('Decoded body loaded.');
        }
        else {
          taskTest.page.loaded = cheerio.load(body);
          console.log('Undecoded body loaded.');
        }
      }
      else {
        console.log(err);
      }

      //
      // Callback to begin testing selectors and patterns
      //
      finishCallback && finishCallback(taskTest);
    });
  }
  
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

function handleGetLinksTask(taskTest) {

  var config = taskTest.config;

  var selectors = config.selectors;
  var patterns = config.patterns;

  var root = selectors.container || 'body';

  var result = {
    hasNextPage: false,
    hasPrevPage: false,
    links: [],
  };

  var $ = taskTest.page.loaded;

  var container = $(root);

  if (container) {
    
    if (config.pagination) {
      if (selectors.nextPage) {
        result.hasNextPage = !!$(selectors.nextPage);
      }
      
      if (selectors.prevPage) {
        result.hasPrevPage = !!$(selectors.prevPage);
      }
    }
    
    if (config.list && selectors.listItem) {
      
      //
      // Find all items in the list
      //
      var items = container.find(selectors.listItem);
      
      //
      // Loop through all items found and extract the minimum content possible
      //
      for(var i = 0; i < items.length; ++i) {
        var item = $(items[i]);
        var content = extractMinimumContent(item, selectors, patterns);

        if (content.link) {
          result.links.push(content.link);
        }
      }

      //
      // Resolve links
      //
      resolveLinks(taskTest.request, result.links, taskTest.page,
                   config.aspnet, function(err, resolved)
      {
        if (err) {
          console.log(err);
        }
        else {
          taskTest.onFinish && taskTest.onFinish(null, resolved);
        }
      });
      
    }
    else {
      // TODO(diego): Complete
    }
    
  }
}

function handleGetDetailsTask(taskTest) {
 
  var config = taskTest.config;

  console.log('Extracting notice details...');
  var result = extractNotice(taskTest.page, config.selectors, config.patterns, null);

  console.log('Finished extracting notice.');
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

// Usage example
var taskTest = testTask(
  'http://e-negocioscidadesp.prefeitura.sp.gov.br/BuscaLicitacao.aspx',
  'GET_LINKS',
  {
    "aspnet": true,
    "charset": "iso-8859-1",
    "request": {
      "postURI": "BuscaLicitacao.aspx",
      "method": "POST",
      "form": {
        "__EVENTTARGET": "",
        "ctl00$cphConteudo$frmBuscaLicitacao$ddlArea": "",
        "ctl00$cphConteudo$frmBuscaLicitacao$ddlSecretaria": "",
        "ctl00$cphConteudo$frmBuscaLicitacao$ddlModalidade": 9,
        "ctl00$cphConteudo$frmBuscaLicitacao$ddlStatus": 1,
        "ctl00$cphConteudo$frmBuscaLicitacao$txtLicitacao": "",
        "ctl00$cphConteudo$frmBuscaLicitacao$txtProcesso": "",
        "ctl00$cphConteudo$frmBuscaLicitacao$txtDataPublicacaoInicio": "",
        "ctl00$cphConteudo$frmBuscaLicitacao$txtDataPublicacaoFim": "",
        "ctl00$cphConteudo$frmBuscaLicitacao$txtDataAberturaSessaoInicio": "14/10/2016",
        "ctl00$cphConteudo$frmBuscaLicitacao$txtDataAberturaSessaoFim": "14/10/2017",
        "ctl00$cphConteudo$frmBuscaLicitacao$ibtBuscar.x": 23,
        "ctl00$cphConteudo$frmBuscaLicitacao$ibtBuscar.y": 6
      }
    },
    "list": true,
    "pagination": true,
    "selectors": {
      "container": "#ctl00_cphConteudo_gdvResultadoBusca_gdvContent",
      "listItem": "tr",
      "link": "a",
      "number": "td:nth-child(1)",
      "agency": "td:nth-child(2)",
      "modality": "td:nth-child(3)",
      "openDate": "td:nth-child(4)",
      "description": "td:nth-child(5)",
      "nextPage": "#ctl00_cphConteudo_gdvResultadoBusca_pgrGridView_btrNext_lbtText",
      "prevPage": "#ctl00_cphConteudo_gdvResultadoBusca_pgrGridView_btrPrev_lbtText"
    },
    "patterns": {
      "openDate": "\\d{2}\/\\d{2}\\/\\d{4}"
    }
  }
  , function(err, result) {
    //console.log(result);
  }
);

