var path = require('path');
var scrape = require('../../../lib/index');

var options = {
  cookies: true,
  followRedirects: true,
  aspnet: true,
}

scrape(path.join(__dirname, 'config.json'), options, function(err, data) {
  if(err) {
    //console.log(err);
  }

  console.log(data);
});

