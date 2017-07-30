var url = require('url');
var stringutils = require('../utils/stringutils');

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
function extractDownloadInfo(selector, currentURI, container, page) {

  var result = null;

  if (!selector) return result;

  var $ = page;

  var element = $(selector);
  var href = element.attr('href');
  var text = element.text().trim();
  var lowerCaseText = text.toLowerCase();

  href = href.replace(/&amp;/g, '&');

  result = {
    relativeUri: href,
  }

  if (currentURI) {
    result.uri = url.resolve(currentURI, href);
  }

  if (isFileDownloadLink(text)) {
    result.fileName = text;
    result.fileFormat = text.substring(text.lastIndexOf('.') + 1);
  }
  else if (isFileDownloadLink(href)) {
    result.fileName = href.substring(href.lastIndexOf('/') + 1);
    result.fileFormat = href.substring(href.lastIndexOf('.') + 1);
  }
  else if (isJavascriptFunction(href)) {
    var functionName = extractJavascriptFunctionNameFrom(href);
    // What to do in this case?
  }

  return result;
}

/**
 * Checks if is a valid download link/a valid filename
 * @param {string} string String to be checked
 */
function isFileDownloadLink(string) {
  if (!string) return false;
  var test = string.toLowerCase();
  return (
    endsWith(test, '\\.pdf')  || endsWith(test, '\\.doc') ||
    endsWith(test, '\\.docx') || endsWith(test, '\\.zip') ||
    endsWith(test, '\\.rar')  || endsWith(test, '\\.odt') ||
    endsWith(test, '\\.7z')
  );
}

/**
 * Gets the javascript function name from a html string
 */
function extractJavascriptFunctionNameFrom(string) {
  if (!string) return '';

  var name = '';
  var i = 0;
  var extracting = false;
  var readingParameters = false;
  var c = string.charAt(i);
  while (c) {
    switch (c) {
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
          if (extracting && !readingParameters) {
            name += c;
          }
        } break;
    }

    c = string.charAt(++i);

    if (readingParameters)
      break;
  }

  return name;
}

/**
 * Check if is a javascript function
 * @param {string} tring String to be checked
 */
function isJavascriptFunction(string) {
  if (!string) return false;
  var test = string.toLowerCase();
  return stringutils.startsWith(test, 'javascript');
}

function endsWith(strA, strB) {
  return new RegExp(strB + "$").test(strA);
}

module.exports = extractDownloadInfo;
