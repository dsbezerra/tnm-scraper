'use strict';

/**
 * TODO(diego): Logging, refactoring...
 * change routine array items to tasks
 */

var async               = require('async'),
    cheerio             = require('cheerio'),
    crypto              = require('crypto'),
    fs                  = require('fs'),
    iconv               = require('iconv-lite'),
    _                   = require('lodash'),
    request             = require('request'),
    url                 = require('url'),
    util                = require('util'),

    EventEmitter        = require('events');

var logger              = require('./logger');
    

// Got some from Mechanize
var USER_AGENTS = [
  // Linus Firefox
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:43.0) Gecko/20100101 Firefox/43.0',
  // Mac Firefox
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.11; rv:43.0) Gecko/20100101 Firefox/43.0',
  // Mac Safari 4
  'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_2; de-at) AppleWebKit/531.21.8 (KHTML, like Gecko) Version/4.0.4 Safari/531.21.10',
  // Mac Safari
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9',
  // Windows Chrome
  'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/43.0.2357.125 Safari/537.36',
  // Windows IE 10
  'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.2; WOW64; Trident/6.0)',
  // Windows IE 11
  'Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko',
  // Windows Edge
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2486.0 Safari/537.36 Edge/13.10586',
  // Windows Firefox
  'Mozilla/5.0 (Windows NT 6.3; WOW64; rv:43.0) Gecko/20100101 Firefox/43.0',
  // iPhone
  'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B5110e Safari/601.1',
  // iPad
  'Mozilla/5.0 (iPad; CPU OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1',
  // Android
  'Mozilla/5.0 (Linux; Android 5.1.1; Nexus 7 Build/LMY47V) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.76 Safari/537.36'
];


// Get a random user-agent
var defaultUserAgent =
  USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

var defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                'Chrome/46.0.2486.0 ' +
                'Safari/537.36 ' +
                'Edge/13.10586'
};

var Log = null;
var TAG = 'Scraper';

var VERBOSE = false;
var MODALITIES = {
  'pp'                   : 0,
  'pregão presencial'    : 0,
  
  'pe'                   : 1,
  'pregão eletrônico'    : 1,

  'concorrência'         : 2,
  'concorrência pública' : 2,
  'cp'                   : 2,
  
  'convite'              : 3,
  
  'concurso'             : 4,

  'leilão'               : 5,

  'tomada de preço'      : 6,
  'tomada de preços'     : 6,

  'convênio'             : 7
};

var MIN_DELAY = 1000;

var TASK = {
  GET_SESSION  : 'GET_SESSION',
  GET_LINKS    : 'GET_LINKS'  ,
  GET_DETAILS  : 'GET_DETAILS'
};


var LAST_RESULTS = {
  ids: [],
  results: {}
};

function TNMScraper(options) {
  
  var self = this;
  var _options = options || { cookies: true, followRedirects: true };

  Log = new logger({ DEBUG: false, persist: true, name: _options.name });

  EventEmitter.call(self);  

  // Scraper model
  self.scraper = null;
  
  // Scraper request object
  self.request = request;
  // Scraper configuration
  self.options = _options;
  // Callback that handles final result
  self.completeCallback = _options.callback;
  // Routine object
  self.routine = null;
  // Routine queue
  self.routineQueue = null;
  
  // Scraper result object contaning all routines results
  self.results = {};

  // Flag to control if we have an aspnet form or not
  self.aspnet    = false;
  // Used to persist ASP.NET form between requests
  self.aspNetForm = {};
  // Delay used between requests (may be changed with a .json property)
  self.delay = MIN_DELAY;

  // To keep track of scraper progress
  self.stats = {

    isRunning: false,
    error: {},
    
    // Biddings Stats
    totalBiddings: 0,
    currentBidding: 0,
    newBiddings: 0,
    
    // Routines Stats
    totalRoutines: 0,
    currentRoutine: 0,

    // Pagination Stats
    totalPages: 0,
    currentPage: 0
  }
  
  delete _options.callback;
  
  self.init(_options);  
}

// To emit events we need this to be subclass 
util.inherits(TNMScraper, EventEmitter);

TNMScraper.prototype.emitAsync = function(event, data) {
  var self = this;
  setImmediate(function() {
    self.emit(event, data);
  });
};

/**
 * Initializes the scraper then start
 * @param {object} options Scraper configuration
 */
TNMScraper.prototype.init = function(options) {
  
  Log.i(TAG, 'Initializing scraper...');
  
  var self = this;  
  var options = self.options;
  
  // Check for ASPForm Handler
  if(options.aspnet) {
    self.aspnet = options.aspnet;
    Log.d(TAG, 'ASPNet form handler enabled.');
  }

  if(options.state) {
    self.state = options.state;
  }
  
  // Check for delay configuration
  if(options.delay) {
    if(isNaN(options.delay)) {
      Log.w(TAG, 'Delay value is not a number. Setting delay to default ' +
                 self.delay + 'milliseconds.');
    }
    else if (options.delay >= 1000) {
      self.delay = options.delay;
    }
    else {
      throw new Error('Delay must be at least 1000 milliseconds.');
    }
  }
  else {
    Log.i(TAG, 'No delay specified. Using default ' + self.delay + ' milliseconds.');
  }

  // Request Object
  var requestDefaults = {
    encoding: null
  };
  
  if(options.cookies) {
    Log.d(TAG, 'Cookies enabled.');
    requestDefaults.jar = options.cookies;
  }
  else {
    Log.d(TAG, 'Cookies enabled. (Default)');
    requestDefaults.jar = true;
  }

  if(options.followRedirects) {
    Log.d(TAG, 'Follow all redirects enabled.');
    requestDefaults.followAllRedirects = options.followRedirects;
  }
  else {
    Log.d(TAG, 'Follow all redirects enabled. (Default)');
    requestDefaults.followAllRedirects = true;
  }

  if(options.routine) {
    self.routine = options.routine;
    // Initialize regex strings to RegExp object
    for(var routineIndex = 0; routineIndex < options.routine.length; ++routineIndex) {
      var patterns = self.routine[routineIndex].patterns;
      if(patterns) {
        var keys = Object.keys(patterns);
        for(var keyIndex = 0; keyIndex < keys.length; ++keyIndex) {
          var key = keys[keyIndex];
          patterns[key] = new RegExp(patterns[key]);
        }
      }
    }
  }
  else {
    var err = new Error('Routine must exist in Scraper configuration.');
    Log.e(TAG, err.message);
    return self.completeCallback(err);
  }

  if(options.scraper) {
    self.scraper = options.scraper;
    LAST_RESULTS = options.scraper.lastResults;
  }

  self.request = self.request.defaults(requestDefaults);

  delete options.routine;
  
  self.start();
}

/**
 * Start the scraper routines
 */
TNMScraper.prototype.start = function() {
  var _TAG = `${TAG}(RoutineQueue)`;

  var self = this;
  var stats = self.stats;
 
  self.emitAsync('start', 'Scraper started!');
  
  // Define queue
  self.routineQueue = async.queue(function(routine, callback) {
    var id = routine.id;
    Log.i(_TAG, 'Starting routine: ' + routine.name);
    switch(id) {
      case TASK.GET_SESSION:
      {
        //stats.message = 'Adquirindo sessão...';
        self.getSession(callback);
      } break; 
      case TASK.GET_LINKS:
      {
        //stats.message = 'Extraindo links...';
        self.scrapeLinks(callback);
      } break;
      case TASK.GET_DETAILS:
      {
        //stats.message = 'Extraindo detalhes das licitações...';
        self.scrapeDetails(callback);
      } break;
    }
  });

  // Loop through all routines and add to queue
  var routine = self.routine;
  for(var routineIndex = 0; routineIndex < routine.length; ++routineIndex) {
    self.routineQueue.push(routine[routineIndex], function(err, result) {
      // Default callback
      if(err) {
        Log.e(TAG, err.message);
        return;
      }
      
      var routineId = routine[stats.currentRoutine].id;
      
      if(result) {
        if(result.length === 0) {
          self.routineQueue.kill();
          return self.completeCallback(null, result);
        }
        
        self.results[routineId] = result;
      }

      
      Log.i(_TAG, 'Finished routine: ' + routine[stats.currentRoutine++].name, result);
    });
  }

  // Complete
  self.routineQueue.drain = function(err) {
    if(self.completeCallback) {
      if(err) {
        return self.completeCallback(err, null);
      }

      var notices = self.results[TASK.GET_DETAILS];
      
      self.emitAsync('finish', notices);
      return self.completeCallback(null, notices);
    }
  }
}


/**
 * GetSession routine
 * Must be used to get cookies or ASPNet form data populated (example E-Negócios-SP)
 * @param {function} callback Callback that notify the routine queue to advance
 */
TNMScraper.prototype.getSession = function(nextTask) {

  var _TAG = `${TAG}(GetSession)`;
  
  var self = this;
  var options = self.options;
  // Use baseURI as request uri to get session
  if(options.baseURI) {
    var requestParams = {
      uri: options.baseURI
    };

    self.performRequest(requestParams, function(err, page) {
      if(err) {
        return self.completeCallback(err, null);
      }

      var $ = page['$'];
      if(self.aspnet) {
        self.aspNetForm = getAspNetFormData($);
      }
      
      nextTask();
    });
  }
  else {
    // TODO(diego): Logging
  }
}


/* ScrapeLinks Routine function */
TNMScraper.prototype.scrapeLinks = function(nextTask) {

  var self = this;
  var stats = self.stats;
  
  var currentRoutine = stats.currentRoutine;
  var routine = self.routine[currentRoutine];
  if(routine) {
    if(routine.pagination) {
      self.handlePagination(function(err, contents) {
        if(err) {
          return self.completeCallback(err, null);
        }
  
        nextTask(null, contents);        
      });
    }
    else {
      // TODO(diego): Move this to a function
      var requestParams;
      if(routine.request) {
        requestParams = routine.request;
      }
      else {
        Log.e(_TAG, 'requestParams must be a valid object');
        var err = new Error('requestParams must be a valid object');
        return self.completeCallback(err, null);
      }
      
      self.performRequest(requestParams, function(err, page) {
        if(err) {
          return self.completeCallback(err, null);
        }
        
        var extracted = extractContent(stats, self.options, routine, page['$']);
        self.resolveLinks(extracted, page, requestParams.baseURI, function(err, contents) {
          if(err) {
            return self.completeCallback(err, null);
          }
          nextTask(null, contents);
        });
        
      });
    }
  }
  else {
    var err = new Error('Invalid routine!');
    return self.completeCallback(err, null);
  }
  
}


/* Scrape details */
TNMScraper.prototype.scrapeDetails = function(callback) {

  var _TAG = `${TAG}(scrapeDetails)`;
  
  var self = this;
  var stats = self.stats;
  
  var currentRoutine = stats.currentRoutine;
  var routine = self.routine[currentRoutine];

  // Detail pages queue
  var detailsQueue = async.queue(function(content, next) {

    // TODO(diego): Do checks for any wrong paremeter 
    var requestParams = {
      uri: content.link,
      method: 'GET'
    }
    
    self.performRequest(requestParams, function(err, page) {
      if(err) {
        return callback(err, null);
      }

      var notice = extractNotice(page['$'], routine.selectors, routine.patterns, page.uri);
      
      if(notice) {
        notice._hash = content._hash;
        notice.website = page.uri;
        //self.emitAsync('notice', notice);
        next(null, notice);
      }
      else {
        Log.w(_TAG, 'Skipping notice from page ' + page.uri);
      }
    });
  });

  
  var contents = self.results[TASK.GET_LINKS];
  if(contents) {
    if(contents.length === 0) {
      self.routineQueue.kill();
      self.stats.isRunning = false;
      self.stats.message = 'Nenhuma licitação nova encontrada!';

      if(self.completeCallback) {
        return self.completeCallback(null, contents);
      }
    }
      
    // Update total biddings
    stats.totalBiddings += contents.length;
    
    detailsQueue.push(contents, function(err, resultNotice) {
      if(err) {
        return callback(err, null);
      }

      if(!self.results[TASK.GET_DETAILS]) {
        self.results[TASK.GET_DETAILS] = [];
      }
      
      self.results[TASK.GET_DETAILS].push(resultNotice);

      // Update current scraping detail
      stats.currentBidding++;

      self.emitAsync('stats', stats);
    });
  }

  // Details Queue finished.
  detailsQueue.drain = function() {
    // Persist notices
    // Save last time
    callback(null, self.results[TASK.GET_DETAILS]);
  }
}

TNMScraper.prototype.resolveLinks = function(contents, page, uri, callback) {
  var self = this;
  var stats = self.stats;

  var contentIndex = 0;
  var isASPNet = self.aspnet;

  if(contents.length === 0)
    return callback(null, contents);

  //
  // NOTE(diego): We assume here, that if the first link doesn't need to be resolved,
  // the remaining links doesn't need too;
  //
  const firstLink = contents[contentIndex].link;
  if(!isUriValid(firstLink)) {
    async.whilst(
      function() { return contentIndex < contents.length; },
      function(next) {
        if(isASPNet) {
          var requestParams = {
            method: 'POST',
            uri: uri,
            headers: defaultHeaders,
          };

          var nextLink = contents[contentIndex].link;
          var form = getAspNetFormData(page, nextLink);
          requestParams.form = form;

          self.performRequest(requestParams, function(err, page) {
            if(err) {
              return callback(err);
            }

            contents[contentIndex++].link = page.uri;
            next();
          });
        }
        else {
          contents[contentIndex].link = resolveRelativeURI(page.uri, contents[contentIndex]);
          contentIndex++;
          next();
        }
      },
      function(err) {
        callback(null, contents);
      }
    );
  }
  else {
    var routine = self.routine[stats.currentRoutine];
    if(routine.request && routine.request.baseURI) {
      while(contentIndex < contents.length) {
        var baseURI = routine.request.baseURI;
        contents[contentIndex].link = baseURI + contentIndex[contentIndex++].link;
      }
    }
    else {
      // TODO(diego): See what we can do here...
    }

    callback(null, contents);
  }
}

/* Resolve links */
TNMScraper.prototype._resolveLinks = function(links, page, uri, callback) {
  var self = this;
  var stats = self.stats;
  
  var linkIndex = 0;
  var isASPNet = self.aspnet;
  
  if(!isUriValid(links[0])) {
    async.whilst(
      function() { return linkIndex < links.length; },
      function(next) {
        if(isASPNet) {
          var requestParams = {
            method: 'POST',
            uri: uri,
            headers: defaultHeaders
          };

          var form = getAspNetFormData(page, links[linkIndex]);
          requestParams.form = form;

          self.performRequest(requestParams, function(err, page) {
            if(err) {
              return callback(err, null);
            }

            links[linkIndex] = page.uri;
            linkIndex++;
            next();
          });
        }
        else {
          links[linkIndex] = resolveRelativeURI(page.uri, links[linkIndex]);
          linkIndex++;
          next();
        }
      },
      function(err) {
        callback(null, links);
      }
    );
  }
  else {
    
    var routine = self.routine[stats.currentRoutine];
    if(routine.request && routine.request.baseURI) {
      while(linkIndex < links.length) {
        var baseURI = routine.request.baseURI;
        links[linkIndex] = baseURI + links[linkIndex++];
      }
    }
    else {
      // TODO(diego): See what we can do here...
    }

    callback(null, links);
  }
}

/* Handles the pagination change */
TNMScraper.prototype.handlePagination = function (callback) {
  var self = this;
  var stats = self.stats;
  
  var routine = self.routine[stats.currentRoutine];
  var options = self.options;
  var selectors = routine.selectors;
  var requestParams = routine.request;
  var nextPage, prevPage, combinedLinks = [];  

  if(!requestParams) {
    Log.e(TAG, 'routine has no property request');
    return callback('routine has no property request', null);
  }
  
  if(!routine.request.baseURI) {
    requestParams.baseURI = options.baseURI;
  }

  if(self.aspnet) {
    Object.assign(requestParams.form,
                  self.aspNetForm);
  }
  
  async.doWhilst(
    function(next) {
      self.performRequest(requestParams, function(err, page) {

        stats.currentPage++;
        
        // Update nextPage
        var $ = page['$'];

        nextPage = $(selectors.nextPage);
        if(nextPage) {
          nextPage = nextPage.attr('href');
          nextPage = checkForDoPostBack(nextPage);
        }

        // Reset request params
        requestParams = {};
        requestParams.uri = page.uri;
        // TODO(diego): See if this can be always POST
        requestParams.method = 'POST';

        // Update form parameters
        if(self.aspnet) {
          self.aspNetForm = getAspNetFormData($, nextPage || routine.request.form['__EVENTTARGET']);
          requestParams.form = self.aspNetForm;
        }
        
        var extracted = extractContent(stats, options, routine, $);
        self.resolveLinks(extracted, $, requestParams.uri, function(err, result) {
          if(err) {
            return callback(err, null);
          }

          if(Array.isArray(result)) {
            combinedLinks = combinedLinks.concat(result);
            next(null, result);
          }
        });
      });
    },
    function() {
      return nextPage !== undefined && nextPage !== null;
    },
    function(err) {
      if(err) {
        return callback(err, null);
      }
      return callback(null, combinedLinks);
    }
  );
}

/* Performs a request */
TNMScraper.prototype.performRequest = function(params, callback) {

  var _TAG = `${TAG}(performRequest)`;
  
  var self = this;
  var method, uri, headers, form;

  if(self.request) {
    Log.d(_TAG, 'Setting up request parameters.');
    if(params.uri) {
      uri = params.uri;
    }
    else if(params.baseURI) {
      uri = params.baseURI;
    }
    else {
      var err = new Error('baseURI must be a valid parameter!');
      Log.e(_TAG, 'baseURI must be a valid parameter!');
      return callback(err, null);
    }

    Log.d(_TAG, 'URI: ' + uri);
    
    if(params.method) {
      method = params.method;
    }
    else {
      method = 'GET';
    }

    if(params.postURI) {
      uri = uri + params.postURI;
      if(method !== 'POST') {
        method = 'POST';
      }
      else {
        // TODO(diego): Logging info
      }
    }

    Log.d(_TAG, 'Method: ' + method);

    if(method === 'POST') {
      if(params.form) {
        form = params.form;
      }
      else {
        var err = new Error('POST request must have a post data, check the form parameter!');
        return callback(err, null);
      }
    }
    else {
      if(params.form) {
        form = params.form;
      }     
    }

    Log.d(_TAG, 'Form: ', form);

    headers = params.headers || defaultHeaders || {};

    Log.d(_TAG, 'Headers: ', headers);
  }
  else {
    var err = new Error('request parameter is invalid!');
    return callback(err, null);
  }

  var options = {
    method: method,
    uri: uri,
    headers: headers,
    form: form
  };

  Log.d(_TAG, 'Setting up request parameters completed.');

  var delay = MIN_DELAY;
  if(self.options.randomizeDelay) {
    var random = Math.random() * (self.delay - MIN_DELAY) + MIN_DELAY;
    delay = Math.round(random);
  }

  var seconds = Math.round(delay / 1000);
  Log.i(TAG, `Request in ${seconds}s`);

  setTimeout(function() {
    Log.i(_TAG, 'Requesting URL: ' + uri + ' (' + method + ')');
    self.request(options, function(err, response, body) {
      if(err) {
        return callback(err, null);
      }
      
      var page = {
        uri: response.request.uri.href,
        path: response.request.uri.path,
        '$': loadBody(self.options.charset, body)      
      };
      
      //self.currentPage = page;
      
      return callback(null, page);
    });

  }, delay);
}

TNMScraper.prototype.updateStat = function(newStat) {
  var self = this;
  self.stats = Object.assign(self.stats, newStat);
  self.emitAsync('stats', self.stats);
}

/**
 * Needs refactor
 */
function extractNotice(cheerio, selectors, patterns, currentURI) {
  var $ = cheerio;

  if(!patterns) {
    patterns = {};
  }

  var container = selectors.container ? $(selectors.container) : $('body'); 
  
  var result = {
    description: extractText(container, selectors.description, patterns.description),
    modality: extractText(container, selectors.modality, patterns.modality),
    download: extractDownloadInfo(selectors.link, currentURI, container, $),
    agency: extractText(container, selectors.agency, patterns.agency),
    number: extractText(container, selectors.number, patterns.number),
    // TODO(diego): A extractDate function
    openDate: extractText(container, selectors.openDate, patterns.openDate),
    publishDate: extractText(container, selectors.publishDate, patterns.publishDate)
  };
  
  // Change modality from string to int
  if(result.modality) {
    result.modality = MODALITIES[result.modality.toLowerCase()];
  }

  if(result.openDate) {
    result.openDate = convertToDateFormat(result.openDate);
  }

  if(result.publishDate) {
    result.publishDate = convertToDateFormat(result.publishDate);
  }

  if(!result.description.endsWith('.')) {
    result.description += '.';
  }
  
  return result;
}

/**
 * Check if a given string is a valid URL
 * @param {string} uri URL to be checked
 * @return {boolean} True if is valid and false if not
 */
function isUriValid(uri) {
  if(typeof uri !== 'string') {
    return false;
  }
  else if(uri.match(/(http|https|):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/)) {
    return true;
  }
  else if(uri.startsWith('../') ||
          uri.startsWith('/')   ||
          uri.startsWith('?'))
    {
      return true;
    }

  return false;
}

/**
 * Build a selector string 'tag[attributeName=attributeValue]'
 * @param {object} selector A selector object
 * @return {string} Return the selector string
 */
function buildSelectorString(selector) {
  var element = selector.element;
  var tag = element.tag;
  var name = element.attribute.name;
  var value = element.attribute.value;
  return `${tag}[${name}='${value}']`;
}

/**
 * Checks if is a valid download link/a valid filename
 * @param {string} string String to be checked
 */
function isFileDownloadLink(string) {
  if(!string) return false;
  return (
    string.endsWith('.pdf')  || string.endsWith('.PDF')  ||
    string.endsWith('.doc')  || string.endsWith('.DOC')  ||
    string.endsWith('.docx') || string.endsWith('.DOCX') ||
    string.endsWith('.zip')  || string.endsWith('.ZIP')  ||
    string.endsWith('.rar')  || string.endsWith('.RAR')
  );
}

function resolveRelativeURI(currentURI, relativeURI) {
  return url.resolve(currentURI, relativeURI);
}

/**
 * Extracts download information to a object
 * @param {string} selector Selector of the content
 * @param {object} $ Cheerio object
 * @return {object} A download info object
 *
 * download: {
 *   relativeUri: {string} Relative download URI
 *   uri: {string} Complete download URI
 *   fileName: {string} File name
 *   fileFormat: {string} File Format
 * }
 */
function extractDownloadInfo(selector, currentURI, container, $) {

  var element = $(selector);
  var href = element.attr('href'); 
  var text = element.text().trim();
  var lowerCaseText = text.toLowerCase();

  href = href.replace(/&amp;/g, '&');
  
  var info = {
    relativeUri: href,
    uri: resolveRelativeURI(currentURI, href)
  };

  if (isFileDownloadLink(text)) {
    info.fileName = text;
    info.fileFormat = text.substring(text.lastIndexOf('.') + 1);
  }
  else if (isFileDownloadLink(href)) {
    info.fileName = href.substring(href.lastIndexOf('/') + 1);
    info.fileFormat = href.substring(href.lastIndexOf('.') + 1);
  }
  
  return info;
}

// TODO(diego): Doc
function execRegex(pattern, input) {

  if(typeof pattern !== 'object') {
    pattern = new RegExp(pattern);
  }
  
  var result = input;
  
  if(typeof pattern !== 'undefined') {
    if(Array.isArray(input)) {
      for(var i = 0; i < input.length; i++) {
        var match = pattern.exec(input);
        if(match) {
          // NOTE(diego): Do a loop here to record all matches,
          // if it's necessary
          result = match[0];
          break;
        }
      }
    }
    else {

      // Remove extra line spaces and line breaks
      input = input.replace(/(\r\n|\n|\r|\s+)/gm, " ").replace(/\s{2,}/gm, "\n");

      var match = pattern.exec(input);
      if(match) {
        if(match.length === 1) {
          result = match[0];
        }
        else {
          /*var matches = [];
             for(var matchIndex = 0; matchIndex < match.length; ++matchIndex) {
             matches.push(match[matchIndex]);
             }
             result = matches;
           */

          result = match[match.length - 1];
        }
      }
    }    
  }

  return result;
}

// Works only with chars
function getIndexOf(char, string) {
  var index = 0;
  while(true) {
    var c = string.charAt(index);
    if(c == char)
      return index;

    if(index == string.length - 1)
      return -1;
    
    ++index;
  }
}

function getNIndexOf(char, string, count) {
  var counter = 0;
  var index = 0;
  while(true) {
    var c = string.charAt(index);
    if(c == char) {
      ++counter;
    }

    if(counter == count) {
      return index;
    }

    if(index == string.length - 1 && counter != count) {
      return -1;
    }

    ++index;
  }
}

// Works only with chars
function getLastIndexOf(char, string) {
  var charIndex = 0;
  var index = 0;
  while(true) {
    var c = string.charAt(index);
    if(c == char) {
      charIndex = index;
    }
    else if (index == string.length - 1) {
      return  charIndex || -1;
    }

    ++index;
  }
}

function getSubStringBetween(char, string) {
  var result = '';
  var index = 0;
  var copying = false;
  while(true) {
    var c = string.charAt(index);

    if(copying && c != char) {
      result += c;
    }
    
    if(c == char) {
      if(copying) {
        copying = false;
        break;
      }
      
      copying = true;
    }
    
    ++index;
    
  }
  return result;
}


function getAspNetFormData(cheerio, eventTarget) {

  var _TAG = `${TAG}(getAspNetFormData)`;
  
  var result = {};
  
  //Log.d(_TAG, 'Start extracting ASP.NET form data...');
  var eventValidation    = cheerio('#__EVENTVALIDATION').val();
  var viewStateGenerator = cheerio('#__VIEWSTATEGENERATOR').val();
  var viewState          = cheerio('#__VIEWSTATE').val();
  var eventArgument      = '';

  result['__EVENTARGUMENT']      = eventArgument;
  result['__EVENTVALIDATION']    = eventValidation;
  result['__VIEWSTATEGENERATOR'] = viewStateGenerator;
  result['__VIEWSTATE']          = viewState;

  if(eventTarget) {
    result['__EVENTTARGET']        = eventTarget;
  }
  
  //Log.d(_TAG, 'Finished extracting ASP.NET form data.');
  
  return result;
}

/* Load body */
function loadBody(charset, body) {

  var _TAG = `${TAG}(loadBody)`;
  
  var result;

  if(typeof charset !== 'string') {
    body = charset;
    charset = null;
  }
  
  if(charset) {
    Log.d(_TAG, 'Page charset found (' + charset + '). Start decoding...');
    result = cheerio.load(iconv.decode(body, charset), {
      decodeEntities: false
    });
    Log.d(_TAG, 'Finished decoding page.');
  }
  else {
    result = cheerio.load(body);
  }

  return result;
}

/**
 * Change this to extract content
 */
function extractContent(stats, options, routine, $) {
  var container, selectors, patterns, contents = [];
  
  selectors = routine.selectors;
  if(!selectors) {
    Log.e(_TAG, 'No selectors found in routine.');
    return contents;
  }
  patterns = routine.patterns;
  
  container = selectors.container;
  if(container) {
    container = $(container);
  }
  else {
    Log.w(_TAG, 'No container selector specified.');
  }
  
  if(routine.list && container) {
    if(selectors.listItem) {

      var items = container.find(selectors.listItem);

      //var saved = { first: 0, second: 0 };
      //var firstValidIndex = -1;
      
      for(var i = 0; i < items.length; ++i) {
        var item = $(items[i]);
        var content = extractMinimumContent(item, selectors, patterns);
        content._hash = getHashOfContent(content);
        if(content._hash) {

          if(!LAST_RESULTS.results[content._hash]) {
            console.log("Found new item at index " + i);
            console.log(`[${content._hash}][${content.number}] New!!!`);
            contents.push(content);
            stats.newBiddings++;
          }
          else {
            stats.totalBiddings++;
            console.log(`[${content._hash}][${content.number}] Already in database!!!`);
          }

          
          // Check here if is new content
          //contents.push(content);
          
          //if(firstValidIndex < 0)
          //  firstValidIndex = i; 

          //if(LAST_RESULTS.length === 2) {
          //  if(content.id === LAST_RESULTS[0].id)
          //    saved.first = i;
          //  if(content.id === LAST_RESULTS[1].id)
          //    saved.second = i;
          //}
          //else if (LAST_RESULTS.legnth === 1) {
          //  if(content.id === LAST_RESULTS[0].id)
          //    saved.first = i;
          //}

          
          
        }
      }

      /*var needToCheckForNew = LAST_RESULTS.length > 0;
      
      if(needToCheckForNew) {
        var diff = Math.abs(saved.second - saved.first);
        switch(diff) {
          case 0:
            {
              console.log('No new items found!');
              contents = [];
            } break;

          case 1:
            {
              if(saved.first === firstValidIndex) {
                // No items at top, new items must be after these two last results
                console.log('No new items found!');
                contents = [];
              }
              else {
                console.log('New items at top!');
                // Splice array here
              }
            } break;
            
          default:
            {
              if(saved.first === firstValidIndex) {
                console.log('New items between');
                // Splice array here
              }
              else {
                console.log('New items between and at top!');
                // Splice array here
              }
            } break;
        }
      } */
    }
    else {
      // TODO(diego): Diagnostic
    }
    
  }
  
  return contents;
}

/**
 * Extract the minimum content
 *   
 */
function extractMinimumContent(item, selectors, patterns) {
  var extracted = {};

  if(selectors.modality)
    extracted.modality = extractText(item, selectors.modality, patterns.modality);
  if(selectors.number)
    extracted.number = extractText(item, selectors.number, patterns.number);
  if(selectors.openDate)
    extracted.openDate = extractText(item, selectors.openDate, patterns.openDate);
  if(selectors.publishDate)
    extracted.publishDate = extractText(item, selectors.publishDate, patterns.publishDate);
  if(selectors.description)
    extracted.description = extractText(item, selectors.description, patterns.description);

  if(extracted.number && extracted.description && extracted.openDate)
    extracted.link = extractLink(item, selectors.link);
  else
    return {};
  
  return extracted;
}

/**
 *
 */
function getHashOfContent(content) {
  var hash = '';

  /**
   * NUMBER-DATE-DESCRIPTION md5 hash
   */
  if(content.number && content.openDate && content.description) {
    var string = content.number + content.openDate + content.description;
    hash = crypto.createHash('md5').update(string).digest("hex");
  }

  return hash;
}

/**
 * Extracts the text from a item, using selector and/or regex,
 * use arrays to handle multiple selectors and patterns
 */
function extractText(item, selector, pattern) {
  var text = '';

  if(selector && pattern) {
    text = getTrimText(item, selector);
    text = execRegex(pattern, text);
  }
  else if (selector) {
    text = getTrimText(item, selector);
  }
  else if (pattern) {
    text = execRegex(pattern, getTrimText(item));
  }

  return text;
}

/**
 * Extracts link from element
 * @param {object} item - html element
 * @param {string} selector - link selector
 */
function extractLink(item, selector) {
  var link = '';
  if(!selector) {
    link = item.find('a');
  }
  else {
    link = item.find(selector);
  }

  if(link) {
    var href = link.attr('href');
    if(href) {
      href = checkForDoPostBack(href);
      link = href;
    }
    else {
      // TODO(diego): Diagnostic
    }
  }
  else {
    // TODO(diego): Diagnostic
  }

  return link;
}

/**
 * Returns the text from element trimmed.
 */
function getTrimText(item, selector) {
  var text = '';

  if(_.isArray(selector)) {
    for(var i = 0; i < selector.length; ++i) {
      text = item.find(selector[i]).text().trim();
      if(text)
        break;
    }
  }
  else if(selector) {
    text = item.find(selector).text().trim();
  }
  else {
    text = item.text().trim();
  }

  return text;
}

/* Check if the href value is a doPostBack javascript call
   and returns only the EVENTTARGET */
function checkForDoPostBack(href) {

  if(!href) {
    return null;
  }
  
  var doPostBackIndex = href.indexOf('__doPostBack');
  if(doPostBackIndex < 0)
    return href;

  var value = getSubStringBetween("'", href);
  //value = value.replace(/\$/g, '_');
  return value;
}



function convertToDateFormat(dateString) {
  var date;

  if(dateString.indexOf('/') > -1)
    date = convertToDate('/', dateString);
  else if(dateString.indexOf('-') > -1)
    date = convertToDate('-', dateString);

  return date;
}

function convertToDate(delimiter, string) {
  if(!string)
    return null;

  if(!delimiter)
    return null;

  var parts = string.split(delimiter);
  if(parts.length === 3) {
    // TODO(diego): Do more checks here...
    var year  = Number(parts[2]),
        month = Number(parts[1]),
        day   = Number(parts[0]);

    return new Date(Date.UTC(year, month, day, 12));    
  }

  return null;
}

module.exports = TNMScraper;