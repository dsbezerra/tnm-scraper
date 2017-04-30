var path = require('path');
var fileutils = require('./fileutils');
var stringutils = require('./stringutils');

var reportTo = require('../email_reporter');

var SCRAPER_URI = 'https://scraper-tnmwebapp.rhcloud.com';

var SCRAPER_REPORT_MODEL_PATH = process.env.OPENSHIFT_REPO_DIR
                              ? process.env.OPENSHIFT_REPO_DIR + '/data/email_templates/scraper_results_report.html'
                              : '../../data/email_templates/scraper_results_report.html'; 

module.exports = {
  //
  // Create scraper results report HTML
  //
  createScraperReportHTML: function (scraper, stats) {
    
    var html = null;
    
    if (scraper) {
      
      var modelPath = path.resolve(SCRAPER_REPORT_MODEL_PATH);
      var modelFile = fileutils.readFile(modelPath, { encoding: 'utf8'});
      if (modelFile) {
        
        html = modelFile;
        
        //
        // Replace scraper name
        //
        html = stringutils.replace(html, /%scraper_name%/g, scraper.name);
        
        //
        // Replace new biddings
        //
        html = stringutils.replace(html, /%execution_time%/, new Date(stats.startTime).toDateString());
        
        //
        // Replace new biddings
        //
        html = stringutils.replace(html, /%new_biddings%/g, stats.newBiddings);
        
        //
        // Replace found biddings
        //
        html = stringutils.replace(html, /%found_biddings%/, stats.totalBiddings);
        
        //
        // Replace total extracted
        //
        html = stringutils.replace(html, /%extracted_biddings%/, stats.totalExtracted);
        
        //
        // Replace link
        //
        var link = SCRAPER_URI + '/tools/scraper/' + scraper._id;
        html = stringutils.replace(html, /%scraper_details_page%/, link);
        
        //
        //  Replace year
        //
        html = stringutils.replace(html, /%year%/, new Date().getFullYear());
      }
    }
    
    return html;
  }
  
}
