
//
// TODO(diego): Minimize depedencies use
//

var moment = require('moment');

var extractDownloadInfo = require('./extractDownloadInfo');
var extractText = require('./extractText');

moment.locale('pt-BR');

//
// Modalities possible names. 
// Used when converting String -> Number
//
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

function extractNotice(page, selectors, patterns, currentURI) {
  var $ = page;

  if (!selectors) selectors = {};
  if (!patterns) patterns = {};

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
  
  return result;
}

/**
 * Converts a string date to a Javascript date format.
 * @param {String} dateString A date in string format (DD-MM-YYYY or DD/MM/YYYY) 
 * @return {Date} A javascript date object if successfull, undefined if not
 */
function convertToDateFormat(dateString) {
  var date;

  if(dateString.indexOf('/') > -1)
    date = convertToDate('/', dateString);
  else if(dateString.indexOf('-') > -1)
    date = convertToDate('-', dateString);

  return date;
}

/**
 * Converts a string date to a Javascript date format.
 * @param {String} delimiter A delimiter used when splitting the date
 * @param {String} string A date in string format
 * @return {Date} Returns a javascript date if sucessfull, undefined if not.
 */
function convertToDate(delimiter, string) {
  if(!string)
    return undefined;

  if(!delimiter)
    return undefined;

  var parts = string.split(delimiter);
  if(parts.length === 3) {
    // TODO(diego): Do more checks here...
    var year  = Number(parts[2]),
        month = addZero(Number(parts[1])),
        day   = addZero(Number(parts[0]));
    
    var dateString = year + '-' + month + '-' + day;
    return moment(dateString).hours(3).format();  
  }

  return undefined;
}

function addZero(i) {
  if (i < 10)
    i = '0'  + i;
  
  return i;
}

module.exports = extractNotice;
