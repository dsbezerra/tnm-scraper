const fs = require("fs");
const uuid = require("node-uuid");

/**
 * Get all filenames found in a given directory 
 */
function getFilenamesFromDirectory(path) {
  var result = [];
  
  if(isDirectory(path)) {
    result = fs.readdirSync(path);
  }
  
  return result;
}

/**
 * Check if a given directory path is a directory 
 */
function isDirectory(path) {
  var result = false;
  var stats = statsOf(path);
  
  if(stats)
    result = stats.isDirectory();
  
  return result;
}

/**
 * Check if a given file path is a file 
 */
function isFile(path) {
  var result = false;
  var stats = statsOf(path);
  
  if(stats)
    result = stats.isFile();
  
  return result;
}

/**
 * Check if a give path exists
 */
function exists(path) {
  return isFile(path) || isDirectory(path);
}

/**
 * Create a directory at given path
 */
function createDirectory(path) {
  var stats = statsOf(path);
  if(!stats) {
    var forwardSlash = path.indexOf('/') > -1;
    var backSlash = path.indexOf('\\') > -1;
    
    var parts = forwardSlash ? path.split('/') : path.split('\\');
    var currentPath = parts[0];
    for(var i = 0; i < parts.length; ++i) {
      if(!exists(currentPath)) {
        fs.mkdirSync(currentPath);
      }
      else if(!isDirectory(currentPath)) {
        fs.mkdirSync(currentPath);
      }
      
      currentPath += '/';
      currentPath += parts[i + 1];
    }
  }
}

function createRandomDirectoryAt(path) {
  var randomName = uuid.v1();
  var finalPath = path + '/' + randomName;
  fs.mkdirSync(finalPath);
  
  return {
    id: randomName,
    destPath: finalPath
  }
}

function removeFile(path) {
  fs.unlinkSync(path);
}

/**
 * This function recursively deletes a directory.
 */
function removeDirectory(path) {
  try {
      fs.rmdirSync(path);
    } 
    catch(e) {
      
      switch(e.code) {
        case 'ENOTEMPTY':
        {
          const filenames = getFilenamesFromDirectory(path);
          filenames.forEach(function(filename) {
            const newPath = path + '/' + filename;
            if(isDirectory(newPath)) {
              removeDirectory(newPath);
            }
            else if(isFile(newPath)) {
              removeFile(newPath);
            }
          });
          
          // After delete all files and directory inside the parent,
          // delete parent.
          fs.rmdirSync(path);
          
        } break;
        
        default: 
          console.log(e);
      }
    }
}

/**
 * Get a Stats object of a file
 */
function statsOf(path) {
  if(!path || typeof path !== 'string') {
    throw new Error('Path argument is invalid, must a valid string!');
  }
  
  var stats;
  
  try {
    stats = fs.statSync(path);
  }
  catch(e) {
    //console.log(e);
  }
  
  return stats;
}

/*** EXPORTS ***/
exports.getFilenamesFromDirectory = getFilenamesFromDirectory;
exports.isDirectory = isDirectory;
exports.isFile = isFile;
exports.createDirectory = createDirectory;
exports.createRandomDirectoryAt = createRandomDirectoryAt;
exports.removeFile = removeFile;
exports.removeDirectory = removeDirectory;
exports.exists = exists;