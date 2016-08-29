var request = require('request');

request('http://download.pokefast.net', function(err, response, body) {
  console.log(body);
});

/*var cheerio = require('cheerio');

var INIT_URL = 'http://e-negocioscidadesp.prefeitura.sp.gov.br/';
var defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_4) ' +
                'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                'Chrome/37.0.2062.94 Safari/537.36',
}

// Enable cookies
// Enable followAllRedirects to redicrect automatically
var request = request.defaults({
  jar: true,
  followAllRedirects: true
});

request(INIT_URL, function(err, response) {
  if(err) {
    console.log(err);
  }
  
  var $ = cheerio.load(response.body);

  // If ASPNET FORM get these
  var __VIEWSTATE = $('#__VIEWSTATE').val();
  var __VIEWSTATEGENERATOR = $('#__VIEWSTATEGENERATOR').val();;
  var __EVENTVALIDATION = $('#__EVENTVALIDATION').val();

  var TABLE_ID = '#ctl00_cphConteudo_uccPainelLicitacao_gdvContent';

  var tableNode = $(TABLE_ID);
  var tableRows = tableNode.find('tr');

  var __EVENTTARGETS = [];
  for(var i = 0; i < tableRows.length; ++i) {
    var aNode = $(tableRows[i]).find('a');
    var aNodeId = aNode.attr('id');
    __EVENTTARGETS.push(aNodeId.split('_').join('$'));
  }
  
  var options = {
    method: 'POST',
    url: INIT_URL,
    headers: defaultHeaders,
  };

  var r = request(options, function(err, response, body) {
    if(err) {
      console.log(err);
    }
    else {

      // Use response.request.href to get the new url
      //
      var nextUri = '';
      var redirected = false;
      var redirect = response.request._redirect;
      if((redirect.followAllRedirects || redirect.followRedirect || redirect.followRedirects) && redirect.redirectsFollowed > 0) {
        redirected = true;
        // This becomes the new url
        nextUri = response.request.href;
      }
      
      // Scrape list links
      var $Result = cheerio.load(body); 

      RESULT__VIEWSTATE = $Result('#__VIEWSTATE').val();
      RESULT__VIEWSTATEGENERATOR = $Result('#__VIEWSTATEGENERATOR').val();
      RESULT__EVENTVALIDATION = $Result('#__EVENTVALIDATION').val();
      
      var RESULT_TABLE_ID = '#ctl00_cphConteudo_gdvResultadoBusca_gdvContent';
      
      var resultTableNode = $Result(RESULT_TABLE_ID);
      var resultTableRows = resultTableNode.find('tr');

      var RESULT__EVENTTARGETS = [];
      for(var i = 0; i < resultTableRows.length; ++i) {
        var aNode = $(resultTableRows[i]).find('a');
        var aNodeId = aNode.attr('id');
        if(aNodeId)
          RESULT__EVENTTARGETS.push(aNodeId.split('_').join('$'));
      }

      // Begin request
      var options = {
        method: 'POST',
        url: nextUri,
        headers: defaultHeaders,
      };

      var r = request(options, function(err, response, body) {
        if(err) {
          console.log(err);
        }
        else {
          // Crawl data
          var nextUrl = '';
          var redirected = false;
          var redirect = response.request._redirect;
          if((redirect.followAllRedirects || redirect.followRedirect || redirect.followRedirects) && redirect.redirectsFollowed > 0) {
            console.log(redirect);
          }
        }
      });

      var form = r.form();
      form.append('__EVENTTARGET', RESULT__EVENTTARGETS[0]);
      form.append('__EVENTARGUMENT', '');
      form.append('__EVENTVALIDATION', RESULT__EVENTVALIDATION);
      form.append('__VIEWSTATEGENERATOR', RESULT__VIEWSTATEGENERATOR);
      form.append('__VIEWSTATE', RESULT__VIEWSTATE);
      form.append('ctl00$ajaxMaster', RESULT__EVENTTARGETS[0]);
    }
    
  });

  var form = r.form();
  form.append('__EVENTTARGET', __EVENTTARGETS[0]);
  form.append('__EVENTARGUMENT', '');
  form.append('__EVENTVALIDATION', __EVENTVALIDATION);
  form.append('__VIEWSTATEGENERATOR', __VIEWSTATEGENERATOR);
  form.append('__VIEWSTATE', __VIEWSTATE);
  form.append('ctl00$ajaxMaster', __EVENTTARGETS[0]);
  
});*/
