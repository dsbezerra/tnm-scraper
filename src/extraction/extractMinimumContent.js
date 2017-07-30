
var extractText = require('./extractText');
var extractLink = require('./extractLink');

/**
 * Extract the minimum content from a given HTML element
 * @param {object} item HTML element
 * @param {object} selectors Array of selectors to use when extracting content
 * @param {object} patterns Array of patterns to use when extracting content
 * @return {object} A minimum content object to use when hashing
 */
function extractMinimumContent(item, selectors, patterns) {
  var extracted = {};

  if (selectors.modality)
    extracted.modality = extractText(item, selectors.modality, patterns.modality);
  if (selectors.agency)
    extracted.agency = extractText(item, selectors.agency, patterns.agency);
  if (selectors.number)
    extracted.number = extractText(item, selectors.number, patterns.number);
  if (selectors.openDate)
    extracted.openDate = extractText(item, selectors.openDate, patterns.openDate);
  if (selectors.publishDate)
    extracted.publishDate = extractText(item, selectors.publishDate, patterns.publishDate);
  if (selectors.description)
    extracted.description = extractText(item, selectors.description, patterns.description);
  if (selectors.link)
    extracted.link = extractLink(item, selectors.link);
  else
    return {};

  return extracted;
}

module.exports = extractMinimumContent;