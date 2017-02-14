var path = require('path');
var scrape = require('./index');

// If used this way, code will be using the ID as filename to find the .json configuration in ./scrapers folder
const config = {
  scraper: {
    _id: '57e37574557630001122e841',
    name: 'São Paulo - Pregão Presencial'
  }
}

// It's the same as
const configPath = path.join('scrapers', 'ba/salvador/config.json');


// In the first way 'scraperPath', if you want to add new options, you'll need to specify the options parameters
// In the second way you can add any options outside of scraper and ignore the options parameter

const scraper = scrape(configPath, function(err, result) {
  if(err) console.log(err);
  else {
    console.log(result);
  }
});
