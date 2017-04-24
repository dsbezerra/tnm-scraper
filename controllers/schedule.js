var uuid = require('node-uuid');
var path = require('path');

var objectAssign = require('object-assign');

var Schedule = require('../src/models/schedule');

var cronutils = require('../src/utils/cronutils');
var fileutils = require('../src/utils/fileutils');
var stringutils = require('../src/utils/stringutils');

var CRON_DIR = process.env.OPENSHIFT_CRON_DIR || './data/cron';
var WEEKLY_MODEL_PATH = CRON_DIR + '/weekly_model';
var DAILY_MODEL_PATH = CRON_DIR + '/daily_model';

module.exports = {

  //
  // Get a schedule from database
  //
  get: function (req, res) {
    var id = req.params.id;
    if (id) {
      Schedule.find({
        _id: id,
      }, {
        __v: false,
      }, function (err, schedule) {

        if (err) {
          return res.status(500)
                    .send({
                      success: false,
                      message: err.message,
                    });
        }

        return res.send({
          success: true,
          data: schedule,
        });
      });
    } else {
      return res.send({
        success: false,
        message: 'Invalid params.',
      });
    }
  },
  
  //
  // Get all schedules from database
  //
  getAll: function (req, res) {

    var filter = req.query.filter;

    if (filter) {
      try {
        filter = JSON.parse(filter);
      } catch(err) {
        console.log(err);
        filter = null;
      }
    }
    
    Schedule.find(objectAssign({}, filter), {
      __v: false,
    }, function (err, schedules) {

      if (err) {
        return res.status(500)
                  .send({
                    success: false,
                    message: err.message,
                  });
      }

      return res.send({
        success: true,
        data: schedules,
      });
    })
  },

  //
  // Inserts a new schedule
  //
  insert: function (req, res) {
    var id = req.params.id;
    var body = req.body;

    if (id && body) {

      if (body.cron && cronutils.isValid(body.cron) && body.frequency) {

        //
        // Create file
        // 
        var metadata = createFile(id, body.cron,
                                  body.frequency);

        //
        // Create schedule
        //
        var schedule = new Schedule({
          scraper: id,
          cronExpression: body.cron,
          weekday:   metadata.week,
          minutes:   metadata.minutes,
          hours:     metadata.hours,
          frequency: metadata.frequency,
          fileName:  metadata.name
        });

        //
        // Save schedule in database
        //
        schedule.save(function (err) {
          if (err) {
            //
            // If we got an error when saving, remove created script.
            //
            fileutils.removeFile(data.path);
          } else {
            return res.send({
              success: true,
              message: 'Scheduled.'
            })
          }
        });
        
      } else {

        return res.send({
          success: false,
          message: 'Invalid params.'
        }); 
      }
    } else {
      
      return res.send({
        success: false,
        message: 'Invalid params.'
      });
    }
  },

  //
  // Deletes a schedule
  //
  delete: function (req, res) {
    var id = req.params.id;
    if (id) {

      //
      // Find schedule
      //
      Schedule.find({
        _id: id,
      }, {
        __v: false,
      }, function (err, schedules) {

        if (err) {
          console.log(err);
          return res.send({
            success: false,
            message: err.message,
          });
        }
        else {

          //
          // Remove schedule from database
          //
          Schedule.remove({
            _id: id,
          }, function (err, raw) {
            if (err) {
              console.log(err);
              return res.send({
                success: false,
                message: err.message,
              });
              
            } else {
              // Get schedule data
              var schedule = schedules[0];
              
              //
              // If we removed successfully and have a schedule name and frequency
              // remove script from cron dir
              //
              if (schedule.fileName && schedule.frequency) {
                var filePath = `${CRON_DIR}/${schedule.frequency}/${schedule.fileName}.sh`;

                try {
                  fileutils.removeFile(filePath);
                } catch (err) {
                  console.log(err.message);
                }
              }

              return res.send({
                success: true,
                message: 'Schedule removed.'
              })
            }
          });
        }        
      });
    } else {
      return res.send({
        success: false,
        message: 'Invalid params.'
      })
    }
  },

  //
  // Updates a schedule
  // @Incomplete
  //
  update: function (req, res) {
    var id = req.params.id;
    var body = req.body;

    if (id && body) {
      Schedule.update({
        _id: id,
      }, body, function (err, raw) {
        if (err) {
          return res.send({
            success: false,
            message: err.message,
          });
        }

        return res.send({
          success: true,
          message: 'Schedule updated.'
        });
      });
    } else {
      return res.send({
        success: false,
        message: 'Invalid params.'
      })
    }
  }
}

//
// Create a cron script and save in the specified frequency folder
//
function createFile(scraperId, cron, frequency) {

  var modelPath = frequency === 'weekly' ? WEEKLY_MODEL_PATH : DAILY_MODEL_PATH;
  var modelFile = fileutils.readFile(modelPath, { encoding: 'utf8' });
  if (modelFile) {

    //
    // Get values from cron expression
    //
    var minutes = addZero(cronutils.getMinutes(cron));
    var hours   = addZero(cronutils.getHours(cron));
    var week    = cronutils.getWeekday(cron);
    
    var newFile = modelFile;

    //
    // Replace scraper_id
    //
    newFile = stringutils.replace(newFile, /%scraper_id%/, `"${scraperId}"`);

    //
    // Replace week_day
    //
    if (frequency === 'weekly') {
      newFile = stringutils.replace(newFile, /%week_day%/, week);
    }
    
    //
    // Replace time
    //
    newFile = stringutils.replace(newFile, /%time%/, `"${hours}:${minutes}"`);

    //
    // Save to disk
    //
    var fileName = uuid.v1();
    //
    // Save all to minutely folder
    //
    var freqFolder = `${CRON_DIR}/minutely/${fileName}`;
    var filePath = path.resolve(freqFolder);
    fileutils.writeFile(filePath, newFile);

    return {
      name: fileName,
      path: filePath,
      minutes: Number(minutes),
      hours: Number(hours),
      week: Number(week),
      frequency: frequency,
    }
  }
};

//
// Add left zero if needed
//
function addZero(i) {

  var test = i;
  
  if (typeof i === 'string') {
    test = Number(i);
  }

  if (test < 10) {
    test = '0' + test;
  }

  return test;
}
