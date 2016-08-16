'use strict';

/**
 * TODO(diego): Logging
 */

var async = require('async'),
    request = require('request'),
    cheerio = require('cheerio'),
    iconv = require('iconv-lite'),
    fs = require('fs'),
    logger = require('./logger');
    

var defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_4) ' +
                'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                'Chrome/37.0.2062.94 Safari/537.36'
}

var Log          = null;
var _global_self = null;
var TAG = 'Scraper';

var VERBOSE = false;
var MODALITIES = {
  'pregão presencial'  : 0,
  'pregão eletrônico'  : 1,
  'concorrência'       : 2,
  'convite'            : 3,
  'concurso'           : 4,
  'leilão'             : 5,
  'tomada de preço'    : 6,
  'convênio'           : 7
};

// Scraper states
var GET_LINKS   = 'GET_LINKS';
var GET_DETAILS = 'GET_DETAILS';

function isArray(array) {
  return typeof array === 'object' && array.length;
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

function parseNotice(page) {
  var selectors = _global_self._selectors;
  var decoded;
  if(_global_self._pageCharset) {
    //winston.info('Decoding page body...');
    decoded = iconv.decode(page, _global_self._pageCharset);
    //winston.info('Decoding finished.');
  }

  //winston.info('Loading page body into cheerio...');
  var $ = cheerio.load(decoded || page);
  //winston.info('Loading finished.');
  
  var modality,
      agency,
      link,
      description,
      number,
      date;

  //winston.info('Setting up selectors...');
  
  if(selectors.byElement) {
    modality = buildSelectorString(selectors.modality);
    agency = buildSelectorString(selectors.agency);
    link = buildSelectorString(selectors.link);
    description = buildSelectorString(selectors.description);
    number = buildSelectorString(selectors.number);
    date = buildSelectorString(selectors.date);
  }
  else {
    // Use selectors
    modality = selectors.modality;
    number = selectors.number;
    agency = selectors.agency;
    link = selectors.link;
    description = selectors.description;
    date = selectors.date;
  }

  //winston.info('Selectors set up finished.');
  //winston.info('Initializing notice parsing...');
    
  var notice = {
    modality: grabText(modality, $),
    number: grabText(number, $),
    agency: grabText(agency, $),
    download: extractDownloadInfo(link, $),
    description: grabText(description, $),
    date: grabText(date, $)
  };

  //winston.info('Finished parsing ' + notice.number);

  return notice;
}

function applyRegex(notice) {
  var patterns = _global_self._patterns;
  if(!patterns) {
    return notice;
  }
  
  var _notice = {};
  _notice.modality      = execRegex(patterns.modality     , notice.modality);
  _notice.agency        = execRegex(patterns.agency       , notice.agency);
  _notice.date          = execRegex(patterns.date         , notice.date);
  _notice.description   = execRegex(patterns.description  , notice.description);
  _notice.number        = execRegex(patterns.number       , notice.number);
  _notice.download      = notice.download;
  
  if(_notice.modality) {
    _notice.modality = MODALITIES[_notice.modality.toLowerCase()];
  }

  // TODO(diego): Make this robust
  if(!isUriValid(_notice.download.relativeUri)) {
    var baseUrl = _global_self._options.baseUrl;

    if(_notice.download.relativeUri.startsWith('../')) {
      _notice.download.uri = baseUrl
                           + _notice.download.relativeUri.substring(3);
    }
    else {
      _notice.download.uri = baseUrl
                           + _notice.download.relativeUri;
    }
  }
  
  return _notice;
}

/**
 * Checks if is a valid download link/a valid filename
 * @param {string} string String to be checked
 */
function isFileDownloadLink(string) {
  if(!string) return false;
  return (
    string.endsWith('.pdf') || string.endsWith('.PDF') ||
    string.endsWith('.doc') || string.endsWith('.DOC') ||
    string.endsWith('.zip') || string.endsWith('.ZIP')
  );
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
function extractDownloadInfo(selector, $) {

  var element = $(selector);
  var href = element.attr('href');
  var text = element.text().trim();
  var lowerCaseText = text.toLowerCase();
  
  var info = {
    relativeUri: href
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

/*
function grabText(selector, cheerio) {

  var result = '';
  
  if(isArray(selector)) {
    result = [];
    for(var selectorIndex = 0;
      selectorIndex < selector.length;
      selectorIndex++)
      {
        var element = cheerio(selector[selectorIndex]);
        if(element) {
          var text = element.text().trim();
          if(text) {
            result.push(text);
          }
        }
        else {
          // TODO(diego): Diagnostic
        }
      }

    // If there's one record, treat as string
    if(result.length === 1) {
      result = result[0];
    }
  }
  else {
    var element = cheerio(selector);
    if(element) {
      result = element.text().trim();
    }
    else {
      // TODO(diego): Diagnostic
    }
  }

  return result;
}*/

function execRegex(pattern, input) {

  var result = input;
  
  if(typeof pattern !== 'undefined') {
    if(isArray(input)) {
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
      var match = pattern.exec(input);
      if(match) {
        if(match.length === 1) {
          result = match[0];
        }
        else {
          var matches = [];
          for(var matchIndex = 0; matchIndex < match.length; ++matchIndex) {
            matches.push(match[matchIndex]);
          }
          result = matches;
        }
      }
    }    
  }

  return result;
}

function TNMScraper(options) {

  var self = this;
  var _options = options || { cookies: true, followRedirects: true };

  Log = new logger({ DEBUG: true });
  
  // Scraper request object
  self.request = request;

  self.options = _options;
  
  self.routine = null;
  self.routineQueue = null;
  self.currentRoutine = 0;
  self.totalRoutines  = 0;
  self.results = [];

  self.isRequestPending = false;
  self.isRunning = false;
  self.aspnet = false;
  self.delay = 1000;

  self.init(_options);
  
  // Must be here
  _global_self = this;
}

TNMScraper.prototype.init = function(options) {
  
  Log.i(TAG, 'Initializing scraper...');
  
  var self = this;
  var options = self.options;
  
  // Check for ASPForm Handler
  if(options.aspnet) {
    Log.d(TAG, 'ASPNet form handler enabled.');
  }

  if(options.state) {
    self.state = options.state;
  }
  
  /*Check for startUrl configuration, ignores all invalid uris
  if(options.startUrl) {
    var startUrl = options.startUrl;
    if(isArray(startUrl)) {
      var someUrisAreInvalid = false;
      var invalidUris = [];
      var validUris   = [];
      for(var i = 0; i < startUrl.length; ++i) {
        if(!isUriValid(startUrl[i])) {
          if(!someUrisAreInvalid) {
            someUrisAreInvalid = true;
          }
          
          invalidUris.push(startUrl[i]);
        }
        else {
          validUris.push(startUrl[i]);
        }
      }

      if(someUrisAreInvalid) {
        Log.w(TAG, "One or more uris are invalid! The following uris are invalid: ");
        Log.w(TAG, invalidUris.join('\n'));
        Log.i(TAG, 'Ignoring invalid uris ');
        options.startUrl = validUris;
      }

      Log.i(TAG, 'Start URL defined to: ');
      Log.i(TAG, options.startUrl.join('\n'));
    }
    else if(!isUriValid(options.startUrl)) {
      throw new Error('uri must be a valid URL');
    }
    else {
      Log.i(TAG, 'Start URL defined to ' + options.startUrl);
    }
  }
  else {
    throw new Error('startUrl is required to begin scraping');
  }

  */
  
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
    self.totalRoutines = options.routine.length;

    // Initialize regex strings to RegExp object
    for(var routineIndex = 0; routineIndex < self.totalRoutines; ++routineIndex) {
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

  self.request = self.request.defaults(requestDefauls);

  delete options.routine;
  
  self.start();
}

/* Start scraper */
TNMScraper.prototype.start = function() {

  var self = this;

  // Define queue
  self.routineQueue = async.queue(function(routine, callback) {
    var id = routine.id;
    switch(id) {
        case GET_LINKS:
        {
          self.scrapeLinks(callback);
        } break;
        case GET_DETAILS:
        {
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

      self.results.push(result);
      Log.i(TAG, routine[self.currentRoutine++].name + '\n' + result);
    });
  }

  // Complete
  self.routineQueue.drain = function(err, result) {
    console.log(result);
  }
}

/*
  Get links
 */
TNMScraper.prototype.scrapeLinks = function(callback) {
  var self = this;
  var routine = self.routine[self.currentRoutine];

  if(routine) {
    var method, url, form;
    var request = routine.request;
    if(request.method) {
      method = request.method;
    }

    if(method === 'POST') {
      if(request.form) {
        form = request.form;
      }
    }

    if(request.baseUrl && request.postUrl) {
      url = request.baseUrl + request.postUrl;
    }

    var options = {
      method: method,
      uri: url,
      form: form,
      headers: defaultHeaders
    };
    
    self.request(options, function(err, response, body) {
      if(err) {
        return callback(err, null);
      }

      var $ = cheerio.load(body);

      var isContainerIterable = routine.list;
      var selectors = routine.selectors;
      
      var container = $(selectors.container);
      var items = container.find(selectors.link);

      var scrapedLinks = [];
      if(isContainerIterable) {
        for(var itemIndex = 0; itemIndex < items.length; ++itemIndex) {
          var link = $(items[itemIndex]).find('a');
          if(link) {
            scrapedLinks.push(request.baseUrl + link.attr('href'));
          }
        }

        if(scrapedLinks.length !== 0) {
          callback(null, scrapedLinks);
        }
      }      
    });
  }
}

TNMScraper.prototype.scrapeDetails = function(callback) {
  var self = this;
  var delay = self.delay;
  
  var detailsQueue = async.queue(function(detailPage, callback) {    
    var method, url;
    var routine = self.routine[self.currentRoutine];
    if(!routine.request) {
      method = 'GET';

      if(isUriValid(detailPage)) {
        url = detailPage;
      }
    }
    
    var options = {
      uri: url,
      method: method,
      headers: defaultHeaders
    };

    var startTime = Date.now();
    self.request(options, function(err, response, body) {
      if(err) {
        console.log(err);
        return;
      }

      /* Begin parse notice */
      var $ = cheerio.load(body);
      var modality,
          agency,
          link,
          description,
          number,
          date;

      var selectors = routine.selectors;
      var patterns = routine.patterns;
      var notice = {
        modality:        grabText(selectors.modality,      patterns.modality,    $),
        number:          grabText(selectors.number,        patterns.number,      $),
        description:     grabText(selectors.description,   patterns.description, $),
        date:            grabText(selectors.date,          patterns.date,        $),
        agency:          grabText(selectors.agency,        patterns.agency,      $)
      }

      if(notice.modality) {
        notice.modality = MODALITIES[notice.modality.toLowerCase()];
      }
      
      /* End parse notice */
      var endTime;
      Log.i('Next request in ' + Math.round(delay /1000) + 's');
      while((endTime = Date.now()) - startTime < delay) {
        // Put logging seconds here
      }
      
      callback(null, notice);
    });
  });

  detailsQueue.push(self.results[0], function(err, result) {
    if(err) {
      console.log(err);
    }

    if(!self.results[1]) {
      self.results.push([result]);
    }
    else {
      self.results[1].push(result);
    }
    
  });

  detailsQueue.drain = function() {
    console.log(self.results[1]);
  }
}

/* Grab text */
function grabText(selector, pattern, $) {
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
    var text = $('body').text().trim();
    result = execRegex(pattern, text);
  }

  return result;
}

module.exports = TNMScraper;