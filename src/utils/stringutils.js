module.exports = {
  /**
   * Get string between a specified char
   */
  getSubStringBetween: function(char, string) {
    var result = '';
    var index = 0;
    var copying = false;
    
    while (true) {
      var c = string.charAt(index);
      
      if (copying && c != char) {
        result += c;
      }
      
      if (c == char) {
        if (copying) {
          copying = false;
          break;
        }
        
        copying = true;
      }
      
      ++index;
    }
    
    return result;
  },

  /**
   * Get index of a specified char in a string
   */
  getIndexOf: function(char, string) {
    var index = 0;
    
    while (true) {
      var c = string.charAt(index);
      if (c == char)
        return index;

      if (index == string.length - 1)
        return -1;
      
    ++index;
    }
  },

  /**
   * Get the index of a specified char at N times found.
   */
  getNIndexOf: function(char, string, count) {
    var counter = 0;
    var index = 0;
    while (true) {
      var c = string.charAt(index);
      if (c == char) {
      ++counter;
      }

      if (counter == count) {
        return index;
      }

      if (index == string.length - 1 && counter != count) {
        return -1;
      }

      ++index;
    }
  },

  /**
   * Get the last index of a given char
   */
  getLastIndexOf: function(char, string) {
    var charIndex = 0;
    var index = 0;

    while (true) {
      var c = string.charAt(index);
      if (c == char) {
        charIndex = index;
      }
      else if (index == string.length - 1) {
        return charIndex || -1;
      }

      ++index;
    }
  }
}
