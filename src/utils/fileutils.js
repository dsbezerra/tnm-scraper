const fs = require("fs");
const uuid = require("node-uuid");
const encoding = require("encoding");

/**
 * Get filepath of all files inside a given path, including sub directories (optional)
 * @param {String} path Path of directory
 * @param {boolean} includeSubDir True if sub directories must be included, false if not
 * @return {object} Array of file paths inside this directory
 */
 function getFilePathsFromDirectory(path, includeSubDir) {
   var result = [];
   
   var dirContents = getFilenamesFromDirectory(path);
   for(var content = 0; content < dirContents.length; ++content) {
     var fullPath = path + '/' + dirContents[content]; 
     if(isDirectory(fullPath) && includeSubDir) {
       var subDirPaths = getFilePathsFromDirectory(fullPath, includeSubDir);
       result = result.concat(subDirPaths);
     }
     else {
       result.push(fullPath);
     }
   }
   
   return result;
 }

/**
 * Get all filenames found in a given directory
 * @param {String} path Path of directory
 * @return {object} Array of filenames founded inside directory
 */
function getFilenamesFromDirectory(path, encoding) {
  var result = [];
  
  if(isDirectory(path)) {
    result = fs.readdirSync(path, { encoding: encoding || 'ISO-8859-1' });
  }
  
  return result;
}

/**
 * Check if a given directory path is a directory 
 * @param {String} path Path of directory to be checked
 * @return {boolean} True if is a directory, false if not
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
 * @param {String} path Path of file to be checked
 * @return {boolean} True if is a file, false if not
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
 * @param {String} path Path of file or directory to be checked
 * @return {boolean} True if exists, false if not
 */
function exists(path) {
  return isFile(path) || isDirectory(path);
}

/**
 * Create a directory at given path (creating directories that doesn't exist)
 * @param {String} path Path of new directory
 * @return {undefined} Nothing
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

/**
 * Create a directory in a given path
 * @param {String} path Root path of the new directory
 * @param {String} name Name of directory
 * @param {boolean} random If the directory name must be random or not
 * @return {undefined} Nothing
 */
function createDirectoryAt(path, name, random) {
  var dirname = name;
  if(random) dirname = uuid.v1();

  var finalPath = path;
  if(endsWith(path, '/')) {
	  finalPath += dirname;
  }
  else {
	  finalPath += '/' + dirname;
  }
  
  fs.mkdirSync(finalPath);
  
  return {
    id: dirname,
    destPath: finalPath
  }
}

/**
 * Deletes a file of give path
 * @param {String} path Path of the file
 * @return {undefined} Nothing
 */
function removeFile(path) {
  fs.unlinkSync(path);
}

/**
 * Get name from a given path
 * @param {String} path Path to be processed.
 * @param {boolean} includeExt True if extension must be included and false if not
 * @return {String} Name of file or directory
 */ 
function getNameFromPath(path, includeExt) {
  var result = '';
  
  if(!path) return result;
  
  var extIndex = -1;
  var slashIndex = -1;
  
  for(var i = 0; i < path.length; ++i) {
    var c = path.charAt(i);
    switch(c) {
      case '/':
        slashIndex = i;
        break;
      case '.':
        extIndex = i;
        break;
      default:
        // Do nothing
        break;
    }
  }
  
  if(includeExt && slashIndex > -1) {
    result = path.substring(slashIndex + 1);
  }
  else {
    if(slashIndex > -1 && extIndex > -1)
      result = path.substring(slashIndex + 1, extIndex);
  }
  
  return result;
}

/**
 * This function recursively deletes a directory.
 * @param {String} path Path of directory
 * @return {undefined} Nothing
 */
function removeDirectory(path) {
  
  if(!path)
    throw new Error('path must be valid!');
    
  var filenames = getFilenamesFromDirectory(path);
  filenames.forEach(function(filename) {
    var fullPath = path + '/' + filename;
    if(isDirectory(fullPath)) {
      removeDirectory(fullPath);
    }
    else {
      removeFile(fullPath);
    }
  });
  
  fs.rmdirSync(path);
}

/**
 * Reads a file to a buffer
 * @param {String} path Path of file
 * @return {object} Buffer with file contents
 */
function readFile(path) {
  var result = null;
  
  if(isFile(path)) {
    result = fs.readFileSync(path);
  }
  
  return result;
}

function renameFile(oldPath, newPath) {
	fs.renameSync(oldPath, newPath);
}

function convertEncoding(buffer, to, from) {
  var result = buffer;
  
  result = encoding.convert(buffer, to, from);
  
  return result;
}

/**
 * Get a Stats object of file or directory, or other things handled by stats
 * @param {String} path Path of file or directory
 * @return {object} Stats object
 */
function statsOf(path) {
  /*if(!path || typeof path !== 'string' || typeof path !== 'object') {
    throw new Error('Path argument is invalid, must a valid string!');
  }*/
  
  var stats;
  
  try {
    stats = fs.statSync(path);
  }
  catch(e) {
    //console.log(e);
  }
  
  return stats;
}

function endsWith(strA, strB) {
	return new RegExp(strB + "$").test(strA);
}

/*** EXPORTS ***/
exports.getFilePathsFromDirectory = getFilePathsFromDirectory;
exports.getFilenamesFromDirectory = getFilenamesFromDirectory;
exports.isDirectory = isDirectory;
exports.isFile = isFile;
exports.createDirectory = createDirectory;
exports.createDirectoryAt = createDirectoryAt;
exports.removeFile = removeFile;
exports.getNameFromPath = getNameFromPath;
exports.removeDirectory = removeDirectory;
exports.readFile = readFile;
exports.renameFile = renameFile;
exports.convertEncoding = convertEncoding;
exports.exists = exists;