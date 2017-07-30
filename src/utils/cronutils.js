
var stringutils = require('./stringutils');

// CRON utility functions
// @Incomplete
//
// TODO(diego): **do only if needed**
// - Support for / L, W, #
// - Completely parse the expression to a data structure
//

var Field = {
  SECONDS       : 'seconds',
  MINUTES       : 'minutes',
  HOURS         : 'hours',
  DAY_OF_MONTH  : 'dom',
  MONTH         : 'month',
  DAY_OF_WEEK   : 'dow',
  YEAR          : 'year'
};

//
// Valid fields in order
//
var FIELDS = [
  Field.SECONDS,
  Field.MINUTES,
  Field.HOURS,
  Field.DAY_OF_MONTH,
  Field.MONTH,
  Field.DAY_OF_WEEK,
  Field.YEAR
];

//
// Fields aliases
//
var ALIASES = {
  month: {
    jan:  1,
    feb:  2,
    mar:  3,
    apr:  4,
    may:  5,
    jun:  6,
    jul:  7,
    aug:  8,
    sep:  9,
    oct: 10,
    nov: 11,
    dec: 12,
  },
  dow: {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6
  }
}

// Allowed values in each field
var ALLOWED_VALUES = {
  seconds:       [   0 ,  59  ],
  minutes:       [   0 ,  59  ],
  hours:         [   0 ,  23  ],
  dom:           [   1 ,  31  ],
  month:         [   1 ,  12  ],
  dow:           [   0 ,   6  ],
  year:          [ 1970, 2099 ],
}

// Allowed special characters in each field
var ALLOWED_SPECIAL_CHARACTERS = {
  seconds:       '* , -',
  minutes:       '* , -',
  hours:         '* , -',
  dom:           '* , - ? L W',
  month:         '* , -',
  dow:           '* , - ? L #',
  year:          '* , -'
}

module.exports = {
  //
  // Check if the value is allowed
  //
  isAllowedValue: function(fieldName, value) {

    var result = false;

    console.log('Field name: %s', fieldName);
    console.log('Field value: %s', value);
    
    var size = value.length;
    if (size === 1) {
      if (this.isAllowedSpecialCharacter(fieldName, value)) {
        result = true;
      } else {

        var test = value;
        if (typeof value === 'string') {
          test = Number(value);
        }

        var range = ALLOWED_VALUES[fieldName];
        console.log('Range:');
        console.log(range);
        if (range) {
          var start = range[0];
          var end   = range[1];
          result = test >= start && test <= end;
        }

        console.log('Result: %s', result);
      }
    } else {

      var allowed = ALLOWED_VALUES[fieldName];
      
      // Probably have a - | , | L | W | #
      if (stringutils.contains(value, '-')) {
        var splitted = value.split('-');

        var start = splitted[0];
        var end   = splitted[1];

        start = Number(start);
        if (isNaN(start)) {
          start = splitted[0];
          start = ALIASES[fieldName][start.toLowerCase()];
        }

        end = Number(end);
        if (isNaN(end)) {
          end = splitted[1];
          end = ALIASES[fieldName][end.toLowerCase()];
        }

        var range = this.getAllowedValuesRange(fieldName);
        if (range) {
          result = start >= range.start && end <= range.end;
        }
      } else if (stringutils.contains(value, ',')) {        
        var splitted = value.split(',');
        var range = this.getAllowedValuesRange(fieldName);
        if (range) {
          for (var i = 0; i < splitted.length; ++i) {
            var v = splitted[i];

            v = Number(v);
            if (isNaN(v)) {
              v = splitted[i];
              v = ALIASES[fieldName][v.toLowerCase()];
            }
            
            result = v >= range.start && v <= range.end;
            if (!result) {
              // If any of the values are invalid break
              console.log('Value \'%s\' is invalid!', v);
              break;
            }
          }
        }
      } else if (stringutils.contains(value, '/')) {
        // TODO(diego): Handle / values
        // Say it is valid for now
        result = true;
      } else {
        var range = this.getAllowedValuesRange(fieldName);
        if (range) {
          var test = value;

          test = Number(test);
          if (isNaN(test)) {
            test = value;
            test = ALIASES[fieldName][test.toLowerCase()];
          }

          result = test >= range.start && test <= range.end;
        }
      }
    }

    return result;
  },

  //
  // Check if the character is a allowed special character
  //
  isAllowedSpecialCharacter: function(fieldName, value) {

    var result = false;

    //
    // If value is bigger than one this is not a char
    //
    if (value.length > 1) {
      return result;
    }

    //console.log('Field name: %s', fieldName);
    //console.log('Field value: %s', value);
    
    var chars = ALLOWED_SPECIAL_CHARACTERS[fieldName];
    if (chars) {
      var values = chars.split(' ');
      for (var valueIndex = 0;
           valueIndex < values.length;
           ++valueIndex)
      {
        var v = values[valueIndex];
        result = v === value;

        //console.log('Is allowed: %s', result);

        if (result) {
          break;
        }
      }
    }

    return result;
  },

  //
  // Get start and end allowed values for a field
  //
  getAllowedValuesRange: function(fieldName) {

    var result = null;

    var allowed = ALLOWED_VALUES[fieldName];
    if (allowed) {
      result = {
        start: allowed[0],
        end: allowed[1]
      }
    }
    
    return result;
  },
  
  // 
  // Check if a given CRON expression is valid
  // @Incomplete
  //
  isValid: function(expression) {

    var result = true;

    if (!expression || typeof expression !== 'string') {
      return false;
    }

    // CRON expressions can have five to six fields separated by a white-space.
    // In some uses of the CRON format there is also a seconds field at the beginning of the pattern.
    // In that case, the CRON expression is a string comprising 6 or 7 fields.
    var fields = expression.split(' ');
    if (fields.length >= 5 && fields.length <= 7) {

      for (var i = 0; i < fields.length; ++i) {
        var fieldName = this.getFieldName(i, fields.length);
        var value = fields[i];
        result = this.isAllowedValue(fieldName, value);
        if (!result) {
          break;
        }
      }
    }
    
    return result;
  },

  getFieldName: function(index, length) {

    var fieldName = '';

    if (index < 0 || index > FIELDS.length)
      return fieldName;
    
    if (length === 5) {
      // Exclude first index
      fieldName = FIELDS[index + 1];
    } else if (length === 6 || length === 7) {
      fieldName = FIELDS[index];
    }

    return fieldName;
  },
  
  //
  // Get fields from expression
  //
  getFields: function(expression) {

    var fields = [];

    if (this.isValid(expression)) {
      fields = expression.split(' ');
    }
    
    return fields;
  },

  //
  // Get field index
  //
  getFieldIndex: function(fieldName) {

    var result = -1;
    
    for (var i = 0; i < FIELDS.length; ++i) {
      if (FIELDS[i] === fieldName) {
        result = i;
      }
    }

    return result;
  },
  
  //
  // Get field value
  //
  getFieldValue: function(fieldName, expression) {

    var value = 0;

    var index = this.getFieldIndex(fieldName);
    var fields = this.getFields(expression);
    
    switch(fieldName) {

      case Field.SECONDS:
        if (fields.length >= 6) {
          value = fields[index];
        } 
        break;

      case Field.MINUTES:
      case Field.HOURS:
      case Field.DAY_OF_MONTH:
      case Field.MONTH:
      case Field.DAY_OF_WEEK:
      case Field.YEAR:
        if (fields.length === 7) {
          value = fields[index];
        } else if (fields.length === 5 || fields.length === 6) {
          value = fields[index - 1];
        }
        break;

      default:
        break;
    }

    return value;
  },
  
  //
  // Get weekday from CRON string expression
  //
  getWeekday: function(expression) {
    return this.getFieldValue(Field.DAY_OF_WEEK, expression);
  },
  
  //
  // Get hours from CRON string expression
  //
  getHours: function(expression) {
    return this.getFieldValue(Field.HOURS, expression);
  },
  
  //
  // Get minutes from CRON string expression
  //
  getMinutes: function(expression) {
    return this.getFieldValue(Field.MINUTES, expression);
  },

  //
  // Get seconds from CRON string expression
  //
  getSeconds: function(expression) {
    return this.getFieldValue(Field.SECONDS, expression);
  },
}
