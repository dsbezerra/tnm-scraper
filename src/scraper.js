'use strict';

/**
 * Scraper v1.0
 */

var 
    // Async is used to control tasks
    async               = require('async'),
    // Cheerio is used to parse HTML
    cheerio             = require('cheerio'),
    // Crypto is used to hash strings
    crypto              = require('crypto'),
    // Iconv is used to parse encoded bodies
    iconv               = require('iconv-lite'),
    // Lodash is used to simplify common operations
    _                   = require('lodash'),
    // Request is the main request library used when requesting websites
    request             = require('request'),
    // Used to resolve some uris
    url                 = require('url'),
    // Used because inherits function, simplify inheritance
    util                = require('util'),

    // EventEmitter is used to emit events while scraper is working,
    // I used this to keep track of progress.
    EventEmitter        = require('events').EventEmitter;
    	
// Object.assign polyfill (needed to work with Openshift Node version)
var objectAssign        = require('object-assign');

// Logger util
var logger              = require('./logger');

// Extraction utilities
var checkForDoPostBack      = require('./extraction/checkForDoPostBack');
var extractLink             = require('./extraction/extractLink');
var extractMinimumContent   = require('./extraction/extractMinimumContent');
var extractNotice           = require('./extraction/extractNotice');
var extractText             = require('./extraction/extractText');

var stringutils             = require('./utils/stringutils');

// These user-agents will be handy in future to avoid request by the same User-Agent everytime the Scraper works.
// Not using for now.
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


// Get a random User-Agent
var defaultUserAgent =
  USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

//
// Default headers used in requests
//
var defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                'Chrome/46.0.2486.0 ' +
                'Safari/537.36 ' +
                'Edge/13.10586'
};

var Log = null;

// Main Scraper TAG
var TAG = 'Scraper';

var VERBOSE = false;

// 
// Minimum delay possible between each request.
//
var MIN_DELAY = 1000;

//
// Task enumeration
// Can be changed anytime.
//
var TASK = {
  GET_SESSION  : 'GET_SESSION',
  GET_LINKS    : 'GET_LINKS'  ,
  GET_DETAILS  : 'GET_DETAILS'
};

//
// Global last results variable.
// Temporary.
//
var LAST_RESULTS = {
  ids: [],
  results: {}
};

// 
// "Constructor"
//
function TNMScraper(options) {
  
  var self = this;
  var _options = options || { cookies: true, followRedirects: true };

  Log = new logger({ DEBUG: false, persist: false, name: _options.name });

  EventEmitter.call(self);  

  // Scraper model
  self.scraper = null;

  self.page = {
    // Cheerio loaded body
    '$': {},
    // Full url of page
    uri: '',
    // Path of page
    path: '',
  };
  
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
  self.aspnet = false;
  // Used to persist ASP.NET form between requests
  self.aspNetForm = {};
  // Delay used between requests (may be changed with a .json property)
  self.delay = MIN_DELAY;

  // To keep track of scraper progress
  self.stats = {
    isRunning: false,
    startTime: null,
    endTime: null,
    
    error: {},
    
    // Biddings Stats
    totalBiddings: 0,
    totalExtracted: 0,
    currentBidding: 0,
    newBiddings: 0,
    
    // Routine Stats
    totalTasks: 0,
    currentTask: 0,

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
  
  var _TAG = createTag('init', true);
  
  Log.i(_TAG, 'Initializing scraper...');
  
  var self = this;  
  var options = self.options;
  var stats = self.stats;

  self.updateStat({message: 'Iniciando scraper...'});
  
  // Check for ASPForm Handler
  if (options.aspnet) {
    self.aspnet = options.aspnet;
    Log.d(_TAG);
  }

  if (options.state) {
    self.state = options.state;
  }
  
  // Check for delay configuration
  if (options.delay) {
    if (isNaN(options.delay)) {
      Log.w(_TAG, 'Delay value is not a number. Setting delay to default ' +
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
    Log.i(_TAG, 'No delay specified. Using default ' + self.delay + ' milliseconds.');
  }

  // Request Object
  var requestDefaults = {
    encoding: null
  };
  
  if (options.cookies) {
    Log.d(_TAG, 'Cookies enabled.');
    requestDefaults.jar = options.cookies;
  }
  else {
    Log.d(_TAG, 'Cookies enabled. (Default)');
    requestDefaults.jar = true;
  }

  if (options.followRedirects) {
    Log.d(_TAG, 'Follow all redirects enabled.');
    requestDefaults.followAllRedirects = options.followRedirects;
  }
  else {
    Log.d(_TAG, 'Follow all redirects enabled. (Default)');
    requestDefaults.followAllRedirects = true;
  }

  if (options.scraper) {
    self.scraper = options.scraper;
    if (options.scraper.lastResults) {
      LAST_RESULTS = options.scraper.lastResults;
    }
  }

  if (options.routine) {
    self.routine = options.routine;
    stats.totalTasks = options.routine.length;
    
    for (var taskIndex = 0; taskIndex < options.routine.length; ++taskIndex) {
      var task = self.routine[taskIndex];
      
      //
      // Check for dynamic strings in request post body
      //
      self.handleFormDynamicStrings(task);
      
      //
      // Initialize all regex strings to RegExp objects
      //
      var patterns = task.patterns;
      if (patterns) {
        var keys = Object.keys(patterns);
        for (var keyIndex = 0; keyIndex < keys.length; ++keyIndex) {
          var key = keys[keyIndex];
          patterns[key] = new RegExp(patterns[key]);
        }
      }
    }
  }
  else {
    var err = new Error('Routine must exist in Scraper configuration.');
    Log.e(_TAG, err.message);
    return;
  }
  
  self.request = self.request.defaults(requestDefaults);

  delete options.routine;
  
  self.start();
}

/**
 * Start the scraper routine
 */
TNMScraper.prototype.start = function() {
  var _TAG = createTag('start', true);
  
  var self = this;
  var stats = self.stats;

  self.emitAsync('start', 'Rodando scraper...');
  self.updateStat({message: 'Rodando scraper...', isRunning: true, startTime: Date.now() });
  
  // Define queue
  self.routineQueue = async.queue(function(task, callback) {
    var id = task.id;
    var message = '';
    Log.i(_TAG, 'Starting task: ' + task.name);
    switch(id) {
      case TASK.GET_SESSION:
      {
        message = 'Adquirindo sessão...';
        self.getSession(callback);
      } break; 
      case TASK.GET_LINKS:
      {
        message = 'Extraindo links...';
        self.scrapeLinks(callback);
      } break;
      case TASK.GET_DETAILS:
      {
        message = 'Extraindo detalhes das licitações...';
        self.scrapeDetails(callback);
      } break;
    }

    self.updateStat({message: message});
  });

  // Loop through all tasks and add to queue
  var routine = self.routine;
  for(var task = 0; task < routine.length; ++task) {
    self.routineQueue.push(routine[task], function(err, result) {
      // Default callback
      if(err) {
        Log.e(TAG, err.message);
        return;
      }
      
      var taskId = routine[stats.currentTask].id;
      
      if(result) {
        self.results[taskId] = result;
      }
      
      Log.i(_TAG, 'Finished task: ' + routine[stats.currentTask++].name, result);
    });
  }

  // Complete
  self.routineQueue.drain = function() {
    Log.i(TAG, "Finished running scraper!");
    if(self.completeCallback) {
      var notices = self.results[TASK.GET_DETAILS];
      stats.isRunning = false;
      stats.endTime = Date.now();
      self.emitAsync('finish', notices);
      return self.completeCallback(null, notices);
    }
  }
}

/**
 * All errors goes into this function. 
 */
TNMScraper.prototype.handleError = function(err) {
  var self = this;
  var stats = self.stats;
  
  Log.e(TAG, err.message);
  
  self.routineQueue.kill();
  self.updateStat({ error: err, isRunning: false });
  
  if(self.completeCallback) {
    return self.completeCallback(err);
  }
  else {
    return err;
  }
}


/**
 * GetSession Task
 * This task must be the first to be executed if the website needs session to
 * resolve its requests.
 * @param {function} nextTask Notifies the queue to advance
 */
TNMScraper.prototype.getSession = function(nextTask) {
  var _TAG = TAG + '(GetSession)';
  
  var self = this;
  var stats = self.stats;
  var options = self.options;
  
  var currentTask = stats.currentTask;
  var task = self.routine[currentTask];
  
  // Use baseURI as request uri to get session
  if(options.baseURI) {
    var requestParams = {
      uri: options.baseURI
    };
    
    if(task.request && task.request.getURI) {
      requestParams.uri = options.baseURI + task.request.getURI;
    }

    self.performRequest(requestParams, function(err) {
      if(!err) {
        var $ = self.page.$;
        if(self.aspnet) {
          self.aspNetForm = getAspNetFormData($);
        }
        nextTask();
      }
      else {
        return self.handleError(err);
      }
    });
  }
  else {
    var err = new Error('A baseURI must be provided to run this task!');
    return self.handleError(err);
  }
}


/**
 * ScrapeLinks Task
 * This task must be the second (if we need to get a session first) or first.
 * Is used to extract all links (that send us to the details page)
 * @param {function} nextTask Notifies the queue to advance
 */
TNMScraper.prototype.scrapeLinks = function(nextTask) {
  var _TAG = TAG + '(scrapeLinks)';

  var self = this;
  var stats = self.stats;
  
  var currentTask = stats.currentTask;
  var task = self.routine[currentTask];
  if(task) {
    if(task.pagination) {
      self.handlePagination(function(err, contents) {
        if(err) {
          stats.isRunning = false;
          return self.completeCallback(err, null);
        }
        
        return nextTask(null, contents);
      });
    }
    else {
      // TODO(diego): Move this to a function
      var requestParams;
      if(task.request) {
        requestParams = task.request;
      }
      else {
        Log.e(_TAG, 'requestParams must be a valid object');
        var err = new Error('requestParams must be a valid object');
        stats.isRunning = false;
        return self.completeCallback(err, null);
      }
      
      self.performRequest(requestParams, function(err, page) {
        if(err) {
          stats.isRunning = false;
          return self.completeCallback(err, null);
        }
        
        var extracted = extractContent(stats, self.options, task, page['$']);

        self.emitAsync('stats', stats);
        
        self.resolveLinks(extracted, page, requestParams.baseURI, function(err, contents) {
          if(err) {
            stats.isRunning = false;
            return self.completeCallback(err, null);
          }
          return nextTask(null, contents);
        });
        
      });
    }
  }
  else {
    var err = new Error('Invalid task!');
    self.stats.isRunning = false;
    return self.completeCallback(err, null);
  }
}


/**
 * ScrapeDetails Task
 * This task must be the third (if the first was GetSession) or second.
 * It's used to extract all details from a page.
 * @param {function} nextTask Notifies the queue to advance
 */
TNMScraper.prototype.scrapeDetails = function(nextTask) {
  var _TAG = TAG + '(scrapeDetails)';
  
  var self = this;
  var stats = self.stats;
  
  var currentTask = stats.currentTask;
  var task = self.routine[currentTask];

  // Detail pages queue
  var detailsQueue = async.queue(function(content, next) {

    // TODO(diego): Do checks for any wrong paremeter 
    var requestParams = {
      uri: content.link,
      method: 'GET'
    }
    
    self.performRequest(requestParams, function(err, page) {
      if(err) {
        return nextTask(err, null);
      }

      var notice = extractNotice(page['$'], task.selectors, task.patterns, page.uri);
     
      if(notice) {
        // Pass hash to final model
        notice._hash = content._hash;
        notice.website = page.uri;
        notice.extractionDate = new Date();
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
      self.stats.message = 'Nenhuma licitação nova encontrada!';
      return nextTask(null, contents);
    }
    
    detailsQueue.push(contents, function(err, resultNotice) {
      if (err) {
        return nextTask(err, null);
      }

      if (!self.results[TASK.GET_DETAILS]) {
        self.results[TASK.GET_DETAILS] = [];
      }

      if (self.scraper) {
        resultNotice.scraper = self.scraper._id;
      }
      
      resultNotice.extracted = false;
      resultNotice.ignored = false;
      
      self.results[TASK.GET_DETAILS].push(resultNotice);

      // Update current scraping detail
      stats.currentBidding++;
      stats.totalExtracted = stats.currentBidding;
      
      self.emitAsync('stats', stats);
    });
  }

  // Details Queue finished.
  detailsQueue.drain = function() {
    var results = self.results[TASK.GET_DETAILS];
    stats.totalExtracted = results.length;
    self.emitAsync('stats', stats);
    nextTask(null, results);
  }
}

/**
 * Resolve relative links to absolute links and/or links that are not links 
 * but parameters to a POST request that will give us an absolute or 
 * relative link.
 * NOTE(diego): This was made with just a few websites in mind. 
 * NEED MORE WORK!
 */
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
  var firstLink = contents[contentIndex].link;
  if(!stringutils.isUriValid(firstLink)) {
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
    var task = self.routine[stats.currentTask];
    if(task.request && task.request.baseURI) {
      while(contentIndex < contents.length) {
        var baseURI = task.request.baseURI;
        contents[contentIndex].link = baseURI + contents[contentIndex++].link;
      }
    }
    else {
      // TODO(diego): See what we can do here...
    }

    callback(null, contents);
  }
}

/* Handles the pagination change */
TNMScraper.prototype.handlePagination = function (callback) {
  var self = this;
  var stats = self.stats;
  
  var task = self.routine[stats.currentTask];
  var options = self.options;
  var selectors = task.selectors;
  var requestParams = task.request;
  var nextPage, prevPage, combinedLinks = [];  

  if(!requestParams) {
    Log.e(TAG, 'task has no property request');
    return callback('task has no property request', null);
  }
  
  if(!task.request.baseURI) {
    requestParams.baseURI = options.baseURI;
  }

  if(self.aspnet) {
    objectAssign(requestParams.form,
                  self.aspNetForm);
  }
  
  async.doWhilst(
    function(next) {
      self.performRequest(requestParams, function(err, page) {

        stats.currentPage++;
        if(stats.totalPages === 0)
          stats.totalPages = stats.currentPage;
        
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
          self.aspNetForm = getAspNetFormData($, nextPage || task.request.form['__EVENTTARGET']);
          requestParams.form = self.aspNetForm;
        }
        
        var extracted = extractContent(stats, options, task, $);
        self.emitAsync('stats', stats);
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

  var _TAG = TAG + '(performRequest)';
  
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
  Log.i(TAG, 'Request in ' + seconds + 's');

  setTimeout(function() {
    Log.i(_TAG, 'Requesting URL: ' + uri + ' (' + method + ')');
    self.request(options, function(err, response, body) {
      if(err) {
        return callback(err, null);
      }

      self.page.$ = loadBody(self.options.charset, body);
      self.page.uri = response.request.uri.href;
      self.page.path = response.request.uri.path;
    
      return callback(null, self.page);
    });

  }, delay);
}

TNMScraper.prototype.updateStat = function(newStat) {
  var self = this;
  self.stats = objectAssign(self.stats, newStat);
  self.emitAsync('stats', self.stats);
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
  return tag + '[' + name + '=' + value + ']';
}

/**
 * Check if is a javascript function
 * @param {string} tring String to be checked
 */
 function isJavascriptFunction(string) {
   if(!string) return false;
   var test = string.toLowerCase();
   return stringutils.startsWith(test, 'javascript');
 }
 
 function extractJavascriptFunctionNameFrom(string) {
   if(!string) return '';
   
   var name = '';
   var i = 0;
   var extracting = false;
   var readingParameters = false;
   var c = string.charAt(i);
   while(c) {
     switch(c) {
       case '(':
         readingParameters = true;
         break;
       case ')':
         readingParameters = false;
         break;
       case ';':
         break;
       case ':':
         extracting = true;
         break;
         
       default:
       {
         if(extracting && !readingParameters) {
           name += c;
         }
       } break;
     }
     
     c = string.charAt(++i);
     
     if(readingParameters)
       break;
   }
   
   return name;
 }
 
function resolveRelativeURI(currentURI, relativeURI) {
  return url.resolve(currentURI, relativeURI);
}

/**
 * Extract ASP.NET form data (some sites use this system when handling forms)
 * @param {object} cheerio Cheerio loaded body
 * @param {String} eventTarget Optional eventTarget form property
 * @return {object} A complete request body with all ASP.NET properties
 */ 
function getAspNetFormData(cheerio, eventTarget) {
  
  var _TAG = createTag('getAspNetFormData');
  
  var result = {};
  
  Log.d(_TAG, 'Start extracting ASP.NET form data...');
  
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
  
  Log.d(_TAG, 'Finished extracting ASP.NET form data.');
  
  return result;
}

/* Load body */
function loadBody(charset, body) {
  var _TAG = TAG + '(loadBody)';
  
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
 * DOC
 */
function extractContent(stats, options, task, $) {
  var _TAG = createTag('extractingContent');
  
  var container, selectors, patterns, contents = [];
  
  selectors = task.selectors;
  if(!selectors) {
    Log.e(_TAG, 'No selectors found in task.');
    return contents;
  }
  patterns = task.patterns;
  
  container = selectors.container;
  if(container) {
    container = $(container);
  }
  else {
    Log.w(_TAG, 'No container selector specified.');
  }
  
  if(task.list && container) {
    if(selectors.listItem || selectors.link) {

      var items = container.find(selectors.listItem || selectors.link);

      for(var i = 0; i < items.length; ++i) {
        var item = $(items[i]);
        var content = extractMinimumContent(item, selectors, patterns);
        content._hash = getHashOfContent(content);

        if(content._hash) {
          // Here we check if the current item is one of the latest results found
          // by scraper. If true, we add to array of contents to be scraped, if false
          // we just ignore it for now.
          if(!LAST_RESULTS.results[content._hash]) {
            Log.i(_TAG, 'New item at index ' + i);
            Log.i(_TAG, 'MD5: ' + content._hash);
            contents.push(content);
            stats.newBiddings++;
          }
          else {
            // TODO(diego): Check here if we have modifications
            // For now, just log that.
            console.log(LAST_RESULTS.results[content._hash]);
            Log.i(_TAG, 'This item already exists in database!');
            
          }
          
          stats.totalBiddings++;
        }
      }
    }
    else {
      // TODO(diego): Diagnostic
    }
    
  }
  
  return contents;
}

/**
 * Creates a unique hash to be used as identifier when comparing contents
 * @param {object} content Content to be hashed
 * @return {String} An unique hash string
 */
function getHashOfContent(content) {
  var hash = '';
  
  var md5 = crypto.createHash('md5');

  /**
   * NUMBER-DATE-DESCRIPTION md5 hash
   */
  /*if(content.number && content.openDate && content.description) {
    var string = content.number + content.openDate + content.description;
    hash = crypto.createHash('md5').update(string).digest("hex");
  }*/
  if(content.number && content.agency && content.modality) {
    var string = content.number + content.agency + content.modality;
    hash = md5.update(string).digest('hex');
  }
  else if (content.link) {
    hash = md5.update(content.link).digest('hex');
  }
  
  Log.d(TAG, 'MD5: ' + hash);

  return hash;
}

/**
 * Create a tag for a subroutine in code
 * @param {String} name Name of the subroutine
 * return {String} A tag name
 */
function createTag(name) {
  var result = TAG + '(' + name + ')';
  
  return result;
}


// Move this to separate file

var SECOND_IN_MILLIS  = 1000;
var MINUTE_IN_MILLIS  = SECOND_IN_MILLIS  *  60;
var HOUR_IN_MILLIS    = MINUTE_IN_MILLIS  *  60;
var DAY_IN_MILLIS     = HOUR_IN_MILLIS    *  24;
var WEEK_IN_MILLIS    = DAY_IN_MILLIS     *   7;
var YEAR_IN_MILLIS    = DAY_IN_MILLIS     * 365;

TNMScraper.prototype.handleFormDynamicStrings = function(task) {

  var self = this;
  
  if (!task) return;
  if (!task.request) return;
  if (task.request.method !== 'POST' || !task.request.form) return;

  var formParams = Object.keys(task.request.form);
  for (var paramIndex = 0; paramIndex < formParams.length; ++paramIndex) {

    //
    // Any string that begins with $ is a dynamic string, check for this
    // NOTE(diego): Change this if we have any website that uses $ as first character
    // in a request body
    //
    
    var param = formParams[paramIndex];
    var value = task.request.form[param];
    
    if (typeof value === 'string' && stringutils.startsWith(value, '$')) {
      
      //
      // If we have 'lastRunDate' use last scraper run date
      //
      if (stringutils.contains(value, 'lastRunDate')) {
        if (self.scraper && self.scraper.lastRunDate) {
          value = dateAsString(new Date(self.scraper.lastRunDate));
          task.request.form[param] = value;
          continue;
        }
        else {
          // Fallback to 'today' case
          value = '$today';
        }
      }
      
      //
      // If we have 'today' use todays date 
      //
      if (stringutils.contains(value, 'today')) {        
        value = dateAsString(new Date());
        task.request.form[param] = value;
        continue;
      }

      //
      // TODO(diego): Support start and end dates and use the
      // start date in all next dates
      //
      
      //
      // If we have 'nextYear' create a date that ends one year from today,
      //
      if (stringutils.contains(value, 'nextYear')) {
        value = dateAsString(new Date(Date.now() + YEAR_IN_MILLIS));
        task.request.form[param] = value;
        continue;
      }

      //
      // TODO(diego): Add more here if necessary
      //
    }
  }
}

function dateAsString(date, format = 'dd/mm/yyyy') {

  var result = null;
  
  var delimiter = '',
      dCount    = 0,
      mCount    = 0,
      yCount    = 0;
  
  for (var i = 0; i < format.length; ++i) {
    var c = format.charAt(i);
    
    if (c === 'd') {
      dCount++;
    }
    else if (c === 'm') {
      mCount++;
    }
    else if (c === 'y') {
      yCount++;
    }
    //
    // If c is a . or - or /
    //
    else if (c === '.' || c === '-' || c === '/') {
      delimiter = c;
    }
  }

  if (!delimiter) {
    throw new Error('Delimiter invalid.');
  }
  
  if (date) {
    var day   = date.getDate(),
        month = date.getMonth() + 1,
        year  = date.getFullYear();

    if (dCount === 2) {
      day = addZero(day);
    }

    if (mCount === 2) {
      month = addZero(month);
    }
        
    if (yCount === 2) {
      // Convert to string and get last two digits
      year = String(year).substring(2);
    }

    // Convert number to strings
    day = String(day);
    month = String(month);
    
    result = (day + delimiter + month + delimiter + year);
  }
  
  return result;
}

function addZero(i) {
  if (i < 10) {
    i = '0' + i;
  }

  return i;
}

module.exports = TNMScraper;
