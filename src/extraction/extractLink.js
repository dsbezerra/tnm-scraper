
var checkForDoPostBack = require('./checkForDoPostBack');

/**
 * Extracts link from element
 * @param {object} item HTML element
 * @param {String} selector Selector string of link
 * @return {String} Returns the link
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
      // Not a link, set empty for now
      link = '';
    }
  }
  else {
    // TODO(diego): Diagnostic
  }

  return link;
}

module.exports = extractLink;
