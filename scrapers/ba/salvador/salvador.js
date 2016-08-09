var path = require('path');
var fs = require('fs');
var scrape = require('../../../lib/index');
var request = require('request');
var cheerio = require('cheerio');

var BASE_URL = 'http://www.compras.salvador.ba.gov.br/novo/';
var SEARCH_FORM_PATH = '?secao=licitacao_busca';
var URLS = [];

var modality = process.argv[2];
if(!modality) {
  throw new Error('Invalid argument');
}

var body = {
  modalidade: modality,
  ordenacao: 'lipr.lipr_data'
};

var options = {
  /*form: {
    action: BASE_URL + SEARCH_FORM_PATH,
    body: body
  }*/
  startUrl: [
    
    'http://www.compras.salvador.ba.gov.br/novo/?secao=licitacao&lipr=003/2015&molp=11&orga=24.00',
    'http://www.compras.salvador.ba.gov.br/novo/?secao=licitacao&lipr=002/2016&molp=11&orga=2483'
  ],
  VERBOSE: true
};

scrape(path.join(__dirname, 'config.json'), options, function(err, result) {
  console.log(result);
});

/*
// http://www.compras.salvador.ba.gov.br/novo/?secao=licitacao_busca
request.post(BASE_URL + SEARCH_FORM_PATH,
 {
   form: {
     modalidade: modality,
     ordenacao: 'lipr.lipr_data',
   }
 }, function(err, response, body) {

   if(err) {
     console.log(err);
   }

   var $ = cheerio.load(body);

   
   var $ = cheerio.load(body);
   var dateGrid = $('div[class=\'grid_1\']');
   var contentGrid = $('div[class=\'grid_5\']');

   for(var i = 0; i < dateGrid.length; i++) {
     if($(dateGrid[i]).text().trim().indexOf('2016') > -1) {
       var href = $(contentGrid[i]).find('a').attr('href');
       URLS.push(href);
     } else {
       break;
     }
   }

   salvador.startRoutine(URLS, function(err, notices) {
     if(err) {
       console.log(err);
     }

     console.log(notices);
   });
   

   var scrapedNotices = [];
   
   var count = 0;
   var interval = setInterval(function() {

     if(count < URLS.length) {
       scrape(path.join(__dirname, 'config.json'), { startUrl: BASE_URL + URLS[count], logLevel: 2 }, function(err, data) {
         if(err) {
           console.log(err);
           return;
         }

         scrapedNotices.push(data);
         count++;
       });
     }
     else {
       clearInterval(interval);
       save(scrapedNotices);
       console.log(scrapedNotices);
     }
     
   }, 5000);   
   
 });


function save(data) {

  const last_update = Date.now();

  const json = {
    last_update: last_update,
    data: data,
  }
  
  fs.writeFile('notices.json', JSON.stringify(json), function(err) {
    if(err) {
      console.log(err);
    }

    console.log("Saved successfully");
  });
}*/