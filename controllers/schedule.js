var uuid = require('node-uuid');
var path = require('path');

var objectAssign = require('object-assign');

var Schedule = require('../src/models/schedule');

var cronutils = require('../src/utils/cronutils');
var fileutils = require('../src/utils/fileutils');
var stringutils = require('../src/utils/stringutils');

var CRON_DIR = './data/cron';
if (process.env.OPENSHIFT_DATA_DIR) {
  CRON_DIR = process.env.OPENSHIFT_DATA_DIR + '/cron';
}
var WEEKLY_MODEL_PATH = './data/cron/weekly_model';
var DAILY_MODEL_PATH = './data/cron/daily_model';

module.exports = {

  //
  // Get a schedule from database
  //
  get: function (req, res) {
    var id = req.params.id;
    if (id) {

      //
      // Find one matching the id passed including the scraper document
      //
      Schedule
        .findOne({ _id: id }, {
          __v: false,
        })
        .populate('scraper', 'name')
        .exec(function(err, schedule) {
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

    //
    // Find all that match filter including scraper document
    //
    Schedule
      .find(objectAssign({}, filter), {
        __v: false,
      })
      .populate('scraper', 'name')
      .exec(function(err, schedules) {
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
      });
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

        if (!metadata) {
          return res.send({
            success: false,
            message: 'Couldn\'t create cron file',
          });
        }

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
            fileutils.removeFile(metadata.path);
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
              // If we removed successfully and have a schedule name
              // remove script from cron dir
              //
              if (schedule && schedule.fileName) {
                var filePath = path.resolve(CRON_DIR + '/minutely/' + schedule.fileName);
                try {
                  fileutils.removeFile(filePath);
                } catch (err) {
                  console.log(err.message);
                }

                //
                // If we are in openshift server, remove file from repo dir at runtime
                //
                if (process.env.OPENSHIFT_REPO_DIR) {
                  var exec = require('child_process').exec;
                  exec('rm $OPENSHIFT_REPO_DIR/.openshift/cron/minutely/' + schedule.fileName);
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
  console.time('create_cron_file');
  
  var result;

  var modelPath = frequency === 'weekly' ? WEEKLY_MODEL_PATH : DAILY_MODEL_PATH;
  var modelFile = fileutils.readFile(path.resolve(modelPath), { encoding: 'utf8' });
  if (modelFile) {

    //
    // Get values from cron expression
    //
    var minutes = addZero(cronutils.getMinutes(cron));
    var hours   = addZero(cronutils.getHours(cron));
    var week    = cronutils.getWeekday(cron);
    
    var newFile = modelFile;

    console.time('create_cron_file_replace_placeholders');

    //
    // Replace scraper_id
    //
    newFile = stringutils.replace(newFile, /%scraper_id%/, '"' + scraperId + '"');

    //
    // Replace week_day
    //
    if (frequency === 'weekly') {
      newFile = stringutils.replace(newFile, /%week_day%/, week);
    }
    
    //
    // Replace time
    //
    var totalMinutes = (hours * 60) + minutes;
    newFile = stringutils.replace(newFile, /%time%/, totalMinutes);

    console.timeEnd('create_cron_file_replace_placeholders');

    //
    // Save to disk
    //
    var fileName = uuid.v1();
    //
    // Save all to minutely folder
    //
    var writePath = 'minutely/' + fileName;
    var filePath = path.join(CRON_DIR, writePath);

    console.log('Creating file at: %s', filePath);
    
    fileutils.writeFile(filePath, newFile);

    //
    // If we are in openshift server, copy file to repo dir at runtime
    //
    if (process.env.OPENSHIFT_REPO_DIR) {
      var exec = require('child_process').exec;
      exec('cp ' + filePath + ' $OPENSHIFT_REPO_DIR/.openshift/cron/minutely');
    }

    result = {
      name: fileName,
      path: filePath,
      minutes: Number(minutes),
      hours: Number(hours),
      week: Number(week),
      frequency: frequency,
    }
  }

  console.timeEnd('create_cron_file');
  
  return result;
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
