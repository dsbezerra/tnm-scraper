
var stringutils = require('../utils/stringutils');

/**
 * Check if the href value is a doPostBack javascript call
 * and returns only the EVENTTARGET 
 * @param {String} href HREF attribute text value
 * @return {boolean} True if contains __doPostBack and false if not
 */
function checkForDoPostBack(href) {

  if (!href) {
    return null;
  }

  var doPostBackIndex = href.indexOf('__doPostBack');
  if (doPostBackIndex < 0)
    return href;

  var value = stringutils.getSubStringBetween("'", href);
  //value = value.replace(/\$/g, '_');
  return value;
}

module.exports = checkForDoPostBack;
