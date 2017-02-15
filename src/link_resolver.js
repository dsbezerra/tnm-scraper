var async = require('async');
var url   = require('url');

var stringutils = require('./utils/stringutils');

var getAspNetFormData = require('./extraction/getAspNetFormData');

var defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                'Chrome/46.0.2486.0 ' +
                'Safari/537.36 ' +
                'Edge/13.10586'
};

module.exports = {

  resolveLinks: function(request, links, page, aspnet, callback) {
    var result = [];

    if (!page) {
      return callback(new Error('page must be provided'));
    }
    
    if (links.length === 0) {
      console.log('No links need to be resolved.');
      return callback(null, result);
    }

    console.log('Resolving links...');
    
    var first = links[0];
    //
    // If these are valid links just resolve them and get the absolute URL
    //
    if (stringutils.isUriValid(first)) {

      console.log('We have links actual links, so begin resolving process.');
      
      var count = 0;
      while (count < links.length) {
        console.log('Resolving link %s of %s', count + 1, links.length);
        var resolved = url.resolve(page.currentUri, links[count]);
        result.push(resolved);
        ++count;
      }

      console.log('All links resolved.');

      return callback(null, result);
    }
    else {

      //
      // If they are not links but strings used in some post request as parameters we gonna
      // need to resolve them by making these requests.
      //
      var count = 0;
      async.whilst(
        function() {
          return count < links.length;
        },
        function(next) {

          console.log('Resolving link %s of %s', count + 1, links.length);
          
          if (aspnet) {
            
            var params = {
              method: 'POST',
              uri: page.currentURI,
              headers: defaultHeaders,
            };

            var link = links[count];
            var form = getAspNetFormData(page.loaded, link);

            params.form = form;

            request(params, function(err, response, body) {
              if (err) return callback(err);
              result.push(response.request.href);
              
              ++count;

              //
              // Just delaying little bit...
              //
              setTimeout(function() {
                next();
              }, 200);
              
            });
          }
          else {
            // TODO(diego): Diagnostic
          }
        },
        function(err) {
          if (!err) {
            console.log('All links resolved.');
            callback(null, result);
          }
          else {
            callback(err);
          }
        }
      )
    }
  }
}