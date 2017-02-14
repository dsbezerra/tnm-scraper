
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

//
// The function extract all notice possible information found at the page.
// Receives a page object, selectors, patterns and a current uri as input
// and outputs a result model object.
// 

// @param {object} contains a cheerio loaded body.
// @param {object} selectors contain selectors used to find the wanted data.
// @param {object} patterns contain regular expressions used to reduce data.
// @param {string} currentURI used in link resolutions, so we can have absolute URL to files.
// @return {object} A filled result model object if successfull, an empty if not. 
// 
function extractNotice(page, selectors, patterns, currentURI) {
  var $ = page;

  if (!selectors) selectors = {};
  if (!patterns) patterns = {};

  //
  // Use the provided container that contains all informations to be extracted
  // If the configuration doesn't specify the container we then use the body selector.
  //
  // If we use body as container, most of the content will be extracted using regular expressions.
  // That means that regular expressions must be well defined if we want to get correct data.
  //
  var container = selectors.container ? $(selectors.container) : $('body'); 
  
  var result = {

    //
    // Extracts the text from description selectors/patterns
    //
    description: extractText(container, selectors.description, patterns.description),

    //
    // Extracts the text from modality selectors/patterns
    //
    modality: extractText(container, selectors.modality, patterns.modality),

    //
    // Extracts the text from agency selectors/patterns
    // Can be only initials or the full name
    //
    agency: extractText(container, selectors.agency, patterns.agency),
    
    //
    // Extract the notice number as text from selectors/patterns
    //
    number: extractText(container, selectors.number, patterns.number),

    //
    // Extract the open date/session date of notice 
    //
    openDate: extractText(container, selectors.openDate, patterns.openDate),

    //
    // Extract the publish date if the website provide it
    //
    publishDate: extractText(container, selectors.publishDate, patterns.publishDate),

    //
    // Extracts the download information from link selector
    //
    download: extractDownloadInfo(selectors.link, currentURI, container, $),
  };

  //
  // Converts modality text to number matching database enumeration
  //
  if (result.modality) {
    result.modality = MODALITIES[result.modality.toLowerCase()];
  }

  //
  // Convert date results from text to date format
  //
  if(result.openDate) {
    result.openDate = convertToDateFormat(result.openDate);
  }

  if(result.publishDate) {
    result.publishDate = convertToDateFormat(result.publishDate);
  }
  
  return result;
}

//
// Converts a string date to a Javascript date format.
// @param {string} dateString A date in string format (DD-MM-YYYY or DD/MM/YYYY) 
// @return {object} A javascript date object if successfull, undefined if not
//
function convertToDateFormat(dateString) {
  var date;

  if(dateString.indexOf('/') > -1)
    date = convertToDate('/', dateString);
  else if(dateString.indexOf('-') > -1)
    date = convertToDate('-', dateString);

  return date;
}

//
// Converts a string date to a Javascript date format.
// @param {string} delimiter A delimiter used when splitting the date
// @param {string} string A date in string format
// @return {object} Returns a javascript date if sucessfull, undefined if not.
//
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

//
// Add a left zero to a number below 10
//
function addZero(i) {
  if (i < 10)
    i = '0'  + i;
  
  return i;
}

module.exports = extractNotice;
