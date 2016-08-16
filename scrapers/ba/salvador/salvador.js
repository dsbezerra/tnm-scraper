var path = require('path');
var scrape = require('../../../lib/index');

scrape(path.join(__dirname, 'config2.json'), {}, function(err, result) {
  console.log(result);
});