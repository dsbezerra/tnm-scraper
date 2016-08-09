'use strict';

/**
 * TODO(diego): Logging
 */

var async = require('async'),
    request = require('request'),
    cheerio = require('cheerio'),
    iconv = require('iconv-lite'),
    winston = require('winston'),
    fs = require('fs');
    

var defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_4) ' +
                'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                'Chrome/37.0.2062.94 Safari/537.36'
}

var _global_self = null;

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
    winston.info('Decoding page body...');
    decoded = iconv.decode(page, _global_self._pageCharset);
    winston.info('Decoding finished.');
  }

  winston.info('Loading page body into cheerio...');
  var $ = cheerio.load(decoded || page);
  winston.info('Loading finished.');
  
  var modality,
      agency,
      link,
      description,
      number,
      date;

  winston.info('Setting up selectors...');
  
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

  winston.info('Selectors set up finished.');
  winston.info('Initializing notice parsing...');
    
  var notice = {
    modality: grabText(modality, $),
    number: grabText(number, $),
    agency: grabText(agency, $),
    download: extractDownloadInfo(link, $),
    description: grabText(description, $),
    date: grabText(date, $)
  };

  winston.info('Finished parsing ' + notice.number);

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

function isFileDownloadLink(uri) {
  return (
    uri.endsWith('.pdf') || uri.endsWith('.PDF') ||
    uri.endsWith('.doc') || uri.endsWith('.DOC') ||
    uri.endsWith('.zip') || uri.endsWith('.ZIP')
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
}

function execRegex(pattern, text) {

  var result = text;
  
  if(typeof pattern !== 'undefined') {
    if(isArray(text)) {
      for(var i = 0; i < text.length; i++) {
        var match = pattern.exec(text);
        if(match) {
          result = match[0];
          break;
        }
      }
    }
    else {
      var match = pattern.exec(text);
      if(match) {
        result = match[0];
      }
    }    
  }

  return result;
}

function TNMScraper(options) {
  var self = this;
  
  var _options = options || { cookies: true, followRedirects: true };

  if(_options.logLevel) {
    VERBOSE = _options.logLevel === 2;
  }
  
  self._request = request;

  self._options = _options;
  self._startUrl = null;
  self._pageCharset = null;
  self._selectors = null;
  self._patterns = null;

  self._results = [];
  
  self._aspnet = false;
  self._delay = 1000;  
  self._isRequestPending = false;
  self._isScrapingFinished = false;
  
  self.init(_options);
  
  // Must be here
  _global_self = this;
/*  
  if(typeof self._startUrl === 'string') {
    self.start();
  }
  else if (typeof self._startUrl === 'object') {
    self.startRoutine();
  }*/

  self.startRoutine();
}

TNMScraper.prototype.init = function(options) {
  var self = this;

  if(VERBOSE) {
    console.log('Initializing scraper...');
  }
  
  if(options.startUrl) {
    var isValid = isUriValid(options.startUrl);
    if(isUriValid) {
      self._startUrl = options.startUrl;
      if(VERBOSE) {
        console.log('Start URL set to: ' + self._startUrl);
      }
    }
    else {
      throw new Error('uri must be a valid URL')
    }
  }
  else {
    throw new Error('startUrl is required to scrape')
  }
  
  self._selectors = options.selectors;

  if(options.aspnet) {
    if(VERBOSE) {
      console.log('Enabling ASPNET form handler');
    }
    self._aspnet = options.aspnet;
  }

  var requestDefauls = {
    encoding: null
  };
  
  if(options.cookies) {
    if(VERBOSE) {
      console.log('Enabling cookies...');
    }
    requestDefauls.jar = options.cookies;
  }

  if(options.followRedirects) {
    if(VERBOSE) {
      console.log('Enable all redirects follow');
    }
    requestDefauls.followAllRedirects = options.followRedirects;
  }

  if(options.pageCharset) {
    if(VERBOSE) {
      console.log('Defining page charset');
    }
    self._pageCharset = options.pageCharset;
  }
  else {
    self._pageCharset = 'utf-8';
  }

  // Init patterns
  if(options.patterns) {
    self._patterns = {};
    var patternsKey = Object.keys(options.patterns);
    for(var i = 0; i < patternsKey.length; i++) {
      var key = patternsKey[i];
      self._patterns[key] = new RegExp(options.patterns[key]);
    }
  }

  self._request = self._request.defaults(requestDefauls);
}

TNMScraper.prototype.start = function() {

  var self = this;
  var options = self._options;
  
  if(VERBOSE) {
    console.log('Initializing first request...');
  }

  var reqOptions = {
    headers: defaultHeaders,
  }
  
  if(options.form) {
    reqOptions.method = 'POST';
    reqOptions.form = options.form.body;
    self._startUrl = options.form.action;
  }

  self._request(self._startUrl, reqOptions, function(err, response, body) {
    if(err && options.callback) {
      return options.callback(err, null);
    }

    if(VERBOSE) {
      console.log('Finished scraping start URL');
    }
    
    return options.callback(null, body);
  });
}

// Routine queue
var q = async.queue(function(page, callback) {
  _global_self._request(page, function(err, response, body) {    
    if(err) {
      return callback(err, null);
    }

    winston.info('Begin processing page: ' + page);
    
    var oldNotice = parseNotice(body);
    var newNotice = applyRegex(oldNotice);

    console.log(newNotice.download);
    
    // Append another useful things
    newNotice.website_page = page;    

    winston.info('Finished processing ' + page);
    
    if(newNotice && oldNotice) {
      return callback(null, { old: oldNotice, new: newNotice });
    }
  });
});

TNMScraper.prototype.startRoutine = function() {
  var self = this;

  if(self._results.length !== 0) {
    self._results = [];
  }
  
  var options = self._options;
    
  q.push(self._startUrl, function(err, notice) {
    if(!err && notice) {
      self._results.push(notice);
      console.log('Finished processing ' + notice.number);
    }
  });

  q.drain = function() {
    console.log('All notices have been processed');
    if(options.callback) options.callback(null, self._results); 
  };
  
}


module.exports = TNMScraper;