var nodemailer = require('nodemailer');
var reportEmail = require('../config/secrets').reportEmail;

var TAG = '[email_reporter.js]';

// Secure SMTP transporter
var transporter = nodemailer.createTransport({
  // TODO(diego): Set pool to true if needed.
  // https://nodemailer.com/smtp/pooled/
  port: reportEmail.port,
  host: reportEmail.host,
  auth: reportEmail.auth,
  secure: true
});

// verify connection configuration
transporter.verify(function(error, success) {
  if (error) {
    console.log(error);
    transporter = null;
  } else {
    console.log('%s : Server is ready to take our messages', TAG);
  }
});

// Reports an error to default email
function report(data, callback) {

  var to = data.to || reportEmail.auth.user;

  if (!transporter) {
    return callback(new Error('Transporter is null!'));
  }

  if (!data) {
    return callback(new Error('Data is null!'));
  }
  
  if (transporter && data) {
    var message = {
      from: to,
      to: to,
      subject: data.subject,
    };

    if (data.html) {
      message.html = data.html;
    }
    else {
      message.text = data.text;
    }
    
    transporter.sendMail(message, function(err, info) {
      if (err) {
        return console.log(err);
      }

      callback(null, 'Reported successfully.');
    });
  }
}

// Reports an error to a specified email
function reportTo(data, callback, email) {
  if (email && data) data.to = email;
  report(data, callback);
}

// For now use as reportTo
module.exports = reportTo;
