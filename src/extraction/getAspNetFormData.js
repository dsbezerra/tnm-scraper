
/**
 * Extract ASP.NET form data (some sites use this system when handling forms)
 * @param {object} cheerio Cheerio loaded body
 * @param {String} eventTarget Optional eventTarget form property
 * @return {object} A complete request body with all ASP.NET properties
 */ 
function getAspNetFormData(page, eventTarget) {
   
  var result = {};

  var $ = page;
  
  var eventValidation    = $('#__EVENTVALIDATION').val();
  var viewStateGenerator = $('#__VIEWSTATEGENERATOR').val();
  var viewState          = $('#__VIEWSTATE').val();
  var eventArgument      = '';

  result['__EVENTARGUMENT']      = eventArgument;
  result['__EVENTVALIDATION']    = eventValidation;
  result['__VIEWSTATEGENERATOR'] = viewStateGenerator;
  result['__VIEWSTATE']          = viewState;

  if(eventTarget) {
    result['__EVENTTARGET']        = eventTarget;
  }
  
  return result;
}

module.exports = getAspNetFormData;