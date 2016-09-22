var mongoose = require('mongoose');

mongoose.Promise = global.Promise;

const Result  = require('./src/models/result');

const user = 'scraper';
const pwd = '123456';

const uri =
  `mongodb://${user}:${pwd}@localhost:27017/tnm`;

mongoose.connect(uri, (err) => {
  if(err) return;

  Result.find({}).lean().exec((err, results) => {
    results.forEach(function(result) {
      updateRecord(result.id);
    });
    
  });
});


var updateRecord = function(id) {
  
  Result.findOne({ id: id }, function(err, doc) {
    if(err) {
      console.log(err);
    }
    else {
      /*if(doc.date) {
        var parts = doc.date.split('/');
        var date = new Date(`'${parts[2]}-${parts[1]}-${parts[0]}'`);
        doc.openDate = date;
        doc.save();
      }*/

      console.log(doc.date);
    }
  });
}