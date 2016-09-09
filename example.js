var scrape = require('./index');
var path = require('path');

var scraper = scrape(path.join('scrapers', 'sp/sao_paulo/config.json'), function(err, result) {
  if(err) {
    return;
  }

  console.log(result);
});

// Events
scraper.on('start', function(message) {
  console.log(message);
})