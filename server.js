var express = require('express');
var exec = require('child_process').exec;
var app = express();

app.get('/', function (req, res) {
  res.send('Hello World!');
});

app.get('/scrapers/:id', function (req, res) {
  var id = req.params.id;

  if (id) {
    exec('node ./scrapers/ba/salvador/salvador.js ' + id, function (err, stdout, stderr) {
      if (err) {
        console.log(err);
        return res.send(err);
      }
      console.log(`stdout: ${stdout}`);

      return res.send({ success: true });
    });
  }
  
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
