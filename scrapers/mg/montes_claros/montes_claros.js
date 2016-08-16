var path = require('path');
var scraper = require('../../../lib/index');

scrape(path.join(__dirname, 'config.json'), {}, function(err, data) {

  if(err) {
    console.log(err);
    return;
  }

  console.log(data);
  
});