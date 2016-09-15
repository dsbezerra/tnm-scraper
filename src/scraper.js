'use strict';

/**
 * TODO(diego): Logging
 */

var async               = require('async'),
    request             = require('request'),
    cheerio             = require('cheerio'),
    iconv               = require('iconv-lite'),
    fs                  = require('fs'),
    logger              = require('./logger'),
    url                 = require('url'),
    util                = require('util'),
    EventEmitter        = require('events');
    

var defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_4) ' +
                'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                'Chrome/37.0.2062.94 Safari/537.36'
}

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

// Scraper states
var GET_SESSION = 'GET_SESSION';
var GET_LINKS   = 'GET_LINKS';
var GET_DETAILS = 'GET_DETAILS';

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
    string.endsWith('.zip')  || string.endsWith('.ZIP')
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
 * Use the 'selectors.links' and 'selectors.container' to extract links.
 * @param {object} options Scraper options
 * @param {object} routine Current routine being processed
 * @param {object} page Page in which links will be extracted
 * return {array} An array with the links extracted
 *        {null} As failure message
 */
function extractLinks(options, routine, page) {
  
  var container,
      selectors,
      links,
      items,
      type,
      isContainerIterable;

  var _TAG = `${TAG}(${routine.name})`;

  var $ = page;
  
  selectors = routine.selectors;
  if(!selectors) {
    Log.e(_TAG, 'No selectors found in configuration.');
    return null;
  }
  
  isContainerIterable = routine.list;  

  if(selectors.container) {
    container = $(selectors.container);
  }
  
  if(isContainerIterable && container) {
    if(selectors.link) {
      items = container.find(selectors.link);
      if(items) {
        links = [];
        for(var itemIndex = 0;
            itemIndex < items.length;
            ++itemIndex)
          {
            var item = items[itemIndex];
            var anchorElement = item;
            if(item.name !== 'a') {
              anchorElement = $(item).find('a');
            }
            else {
              anchorElement = $(item);
            }

            if(anchorElement) {
              var hrefAttributeValue = anchorElement.attr('href');
              if(hrefAttributeValue) {
                hrefAttributeValue = checkForDoPostBack(hrefAttributeValue);                
                // TODO(diego): Check here if is a valid link or some id for a post params
                links.push(hrefAttributeValue);
              }
              else {
                Log.d(_TAG, 'HREF Value at ' +
                            itemIndex + ' invalid.');
              }
            }
            else {
              Log.d(_TAG, 'There\'s no \'a\' element at ' +
                         itemIndex+ '.');
            }
          }

        if(links.length) {
          return links;
        }
      }
      else {
        Log.e(_TAG, 'Could not find any items with this selector \'' +
                   selectors.link + '\'.');
        return null;
      }
    }
    else {
      Log.e(_TAG, '\'selectors.link\' must be a valid selector string!');
      return null;
    }
  }
  else {
    // TODO(diego): Diagnostic
  }
  
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

function getNewestDate(scraper) {

  var dateInMilli = 0;
  
  if(scraper) {
    if(scraper.newestResult) {
      const date = scraper.newestResult.date;
      if(typeof date === 'object') {
        dateInMilli = date.getTime();
      }
    }
  }

  return dateInMilli;
}
 
function TNMScraper(options) {
  
  var self = this;
  var _options = options || { cookies: true, followRedirects: true };

  Log = new logger({ DEBUG: false, persist: true, name: _options.name });

  EventEmitter.call(self);  
  
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

  self.newest = null;

  // To keep track of scraper progress
  self.stats = {

    isRunning: false,
    error: {},
    
    // Biddings Stats
    totalBiddings: 0,
    currentBidding: 0,
    
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
  var stats = self.stats;

  stats.message = 'Inicializando scraper...';
  self.emitAsync('stats', stats);
  
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
      Log.w(TAG, 'Delay value is not a number. Setting delay to default ' + self.delay + 'milliseconds.');
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
  var requestDefauls = {
    encoding: null
  };
  
  if(options.cookies) {
    Log.d(TAG, 'Cookies enabled.');
    requestDefauls.jar = options.cookies;
  }
  else {
    Log.d(TAG, 'Cookies enabled. (Default)');
    requestDefauls.jar = true;
  }

  if(options.followRedirects) {
    Log.d(TAG, 'Follow all redirects enabled.');
    requestDefauls.followAllRedirects = options.followRedirects;
  }
  else {
    Log.d(TAG, 'Follow all redirects enabled. (Default)');
    requestDefauls.followAllRedirects = true;
  }

  if(options.routine) {
    self.routine = options.routine;
    stats.totalRoutines = options.routine.length;

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

  if(options.scraper) {
    self.newest = getNewestDate(options.scraper);
  }

  self.request = self.request.defaults(requestDefauls);

  delete options.routine;
  
  self.start();
}

/**
 * Start the scraper routines
 */
TNMScraper.prototype.start = function() {
  
  var self = this;
  var stats = self.stats;
  var _TAG = `${TAG}(RoutineQueue)`;

  self.emitAsync('start', 'Scraper started!');
  stats.message = 'Iniciando rotinas...';
  self.stats.isRunning = true;
  self.emitAsync('stats', stats);
  
  // Define queue
  self.routineQueue = async.queue(function(routine, callback) {
    var id = routine.id;
    Log.i(_TAG, 'Starting routine: ' + routine.name);
    self.emitAsync('routine', id);
    switch(id) {
      case GET_SESSION:
      {
        stats.message = 'Adquirindo sessão...';
        self.getSession(callback);
      } break; 
      case GET_LINKS:
      {
        stats.message = 'Extraindo links...';
        self.scrapeLinks(callback);
      } break;
      case GET_DETAILS:
      {
        stats.message = 'Extraindo detalhes das licitações...';
        self.scrapeDetails(callback);
      } break;
    }

    self.emitAsync('stats', stats);
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
      self.results[routineId] = result;
      
      Log.i(_TAG, 'Finished routine: ' + routine[stats.currentRoutine++].name, result);

      self.emitAsync('stats', stats);
    });
  }

  // Complete
  self.routineQueue.drain = function(err) {
    if(self.completeCallback) {
      if(err) {
        return self.completeCallback(err, null);
      }

      var notices = self.results['GET_DETAILS'];

      self.stats.isRunning = false;
      self.emitAsync('stats', self.stats);
      return self.completeCallback(null, notices);
    }
  }
}


/**
 * GetSession routine
 * Must be used to get cookies or ASPNet form data populated (example E-Negócios-SP)
 * @param {function} callback Callback that notify the routine queue to advance
 */
TNMScraper.prototype.getSession = function(next) {

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
        return callback(err, null);
      }

      var $ = page['$'];
      if(self.aspnet) {
        self.aspNetForm = getAspNetFormData($);
      }
      
      next();
    });
  }
  else {
    // TODO(diego): Logging
  }
}


/* ScrapeLinks Routine function */
TNMScraper.prototype.scrapeLinks = function(callback) {

  var self = this;
  var stats = self.stats;
  
  var currentRoutine = stats.currentRoutine;
  var routine = self.routine[currentRoutine];
  if(routine) {
    if(routine.pagination) {
      self.handlePagination(function(err, links) {
        if(err) {
          return callback(err, null);
        }

        Log.d(TAG, 'Scraped links: ', links);

        self.results['GET_LINKS'] = links;
        
        return callback(null, links);
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
        return callback(err, null);
      }
      
      self.performRequest(requestParams, function(err, page) {
        if(err) {
          return callback(err, null);
        }
        
        var extracted = extractLinks(self.options, routine, page['$']);
        self.resolveLinks(extracted, page, requestParams.baseURI, function(err, links) {
          if(err) {
            return callback(err, null);
          }

          self.results['GET_LINKS'] = links;
          
          return callback(null, links);
        });
      });
    }
  }
  else {
    var err = new Error('Invalid routine!');
    return callback(err, null);
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
  var detailsQueue = async.queue(function(detailPageUri, next) {

    // TODO(diego): Do checks for any wrong paremeter 
    var requestParams = {
      uri: detailPageUri,
      method: 'GET'
    }
    
    self.performRequest(requestParams, function(err, page) {
      if(err) {
        return callback(err, null);
      }

      var notice = scrapeNotice(self, page['$'],
                                routine.selectors,
                                routine.patterns,
                                page.uri);
      
      if(notice) {
        notice.website = page.uri;
        //self.emitAsync('notice', notice);
        next(null, notice);
      }
      else {
        Log.w(_TAG, 'Skipping notice from page ' + page.uri);
      }
    });
  });


  // scrapeLinks routine results.
  var resultLinks = self.results['GET_LINKS'];
  if(resultLinks) {

    // Update total biddings
    stats.totalBiddings = resultLinks.length;
    
    detailsQueue.push(resultLinks, function(err, resultNotice) {
      if(err) {
        return callback(err, null);
      }

      if(!self.results['GET_DETAILS']) {
        self.results['GET_DETAILS'] = [];
      }
      self.results['GET_DETAILS'].push(resultNotice);


      // Update current scraping detail
      stats.currentBidding++;

      self.emitAsync('stats', stats);
    });
  }

  // Details Queue finished.
  detailsQueue.drain = function() {
    // Persist notices
    // Save last time
    callback(null, self.results['GET_DETAILS']);
  }
}

/* Resolve links */
TNMScraper.prototype.resolveLinks = function(links, page, uri, callback) {
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
        
        var extractedLinks = extractLinks(options, routine, $);
        self.resolveLinks(extractedLinks, $, requestParams.uri, function(err, result) {
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

// Parse detail page to notice object
function scrapeNotice(self, cheerio, selectors, patterns, currentURI) {
  var $ = cheerio;
  var result = {};
  
  var container = selectors.container;

  if(!patterns) {
    patterns = {};
  }

  result['date'] = grabText(selectors.date,
                            patterns.date,
                            container, $);

  //
  // TODO(diego): make this better
  //
  var parts = result.date.split('/');
  var date = new Date('\'' + parts[2] + '-' + parts[1] + '-' + parts[0] + '\'');

  if(self.newest) {
    if(self.newest >= date.getTime()) {
      return null;
    }
  }
  
  result['modality'] = grabText(selectors.modality,
                                patterns.modality,
                                container, $);
  
  result['number'] = grabText(selectors.number,
                              patterns.number,
                              container, $);
  
  result['agency'] = grabText(selectors.agency,
                              patterns.agency,
                              container, $);

  result['download'] = extractDownloadInfo(selectors.link,
                                           currentURI,
                                           container, $);

  result['description'] = grabText(selectors.description,
                                   patterns.description,
                                   container, $).trim();

  // Change modality from string to int
  if(result.modality) {
    result.modality = MODALITIES[result.modality.toLowerCase()];
  }

  if(!result.description.endsWith('.')) {
    result.description += '.';
  }
  
  return result;
}

/* Grab text */
function grabText(selector, pattern, container, $) {
  
  var result = '';
  if(selector && pattern) {
    var text = $(selector).text().trim();
    result = execRegex(pattern, text);
  }
  else if (selector) {
    var text = $(selector).text().trim();
    result = text;
  }
  else if (pattern) {

    var text;
    if(container) {
      text = $(container).text().trim();
    }
    else {
      text = $('body').text().trim();
    }
    
    result = execRegex(pattern, text);
  }

  return result;
}

module.exports = TNMScraper;