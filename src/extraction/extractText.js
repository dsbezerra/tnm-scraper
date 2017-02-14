var _ = require('lodash');

/**
 * Extracts the text from a item, using selector and/or regex,
 * use arrays to handle multiple selectors and patterns
 * @param {object} item HTML element
 * @param {String} selector Selector string of element
 * @param {String} pattern Pattern to be used when extracting text
 * @return {String} Extracted text
 */
function extractText(item, selector, pattern) {
  var text = '';

  if(selector && pattern) {
    text = getTrimText(item, selector);
    text = execRegex(pattern, text);
    //
    // Trim after regex execution to make sure we are trimming the final text
    //
    text = text.trim();
  }
  else if (selector) {
    text = getTrimText(item, selector);
  }
  else if (pattern) {
    text = execRegex(pattern, item.text());
    //
    // Same as above
    //
    text = text.trim();
  }

  return text;
}

/**
 * Returns the text from element trimmed.
 * @param {object} item HTML element
 * @param {String} selector Selector string of element
 * @return {String} Returns the text trimmed
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

/**
 * Executes a regex expression in a given input and return the match
 */
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


module.exports = extractText;
