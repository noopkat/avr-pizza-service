'use strict';

const child = require('child_process');
const path = require('path');
const fs = require('fs');
const uuid = require('node-uuid');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const os = require('os');

function Compiler() {
  // create a unique id for this instance for dir naming
  this.id = uuid.v1();

  let binBasePath = path.join(__dirname, '..', 'bin', 'builder', 'arduino-1.6.9');
  let sketchBasePath = path.join(os.homedir(), 'tmp', this.id);

  // eventually these should be json / env prefs  
  this.paths = {
    arduinoBuilder: path.join(binBasePath, 'arduino-builder'),
    libraries: path.join(binBasePath, 'libraries'),
    hardware: path.join(binBasePath, 'hardware'),
    tools: path.join(binBasePath, 'hardware', 'tools'),
    builder_tools: path.join(binBasePath, 'tools-builder'),
    sketch: sketchBasePath,
    sketchLibs: path.join(sketchBasePath, 'libs'),
    sketchBuild: path.join(sketchBasePath, 'dist')
  };

  this.sketchFile = null;
}

Compiler.prototype.compile = function(request, callback) {
  let self = this;
  let query = request.payload;
  
  self.prepareBuild(query, function(error) {
    self.depositFiles(query, function(error, hex) {
      self.buildSketch(query, function(error, hex) {
       self.cleanUp(function(error) {
          return callback(null, hex);
        });
      });
    });
  });
}

Compiler.prototype.buildSketch = function(query, callback) {
  /*
    query.board
    query.libraries
    query.files
    query.format
    query.version
  */

  let self = this;

  let version = query.version || '16800';
  let board = query.board || 'uno';


  let builderString = [
    ` -hardware="${self.paths.hardware}"`,
    `-tools="${self.paths.tools}"`,
    `-tools="${self.paths.builder_tools}"`,
    `-fqbn="arduino:avr:${board}"`,
    `-libraries="${self.paths.libraries}"`,
    `-libraries="${self.paths.sketchLibs}"`,
    `-core-api-version=${version}`,
    `-build-path="${self.paths.sketchBuild}"`,
    path.join(self.paths.sketch, self.sketchFile)
  ].join(' ');

  let builderChild = child.exec(self.paths.arduinoBuilder + builderString, function(error) {
    console.log('compilation completed.', console.log(error));
    fs.readFile(path.join(self.paths.sketchBuild, `${self.sketchFile}.hex`), function(error, file) {
      console.log(error, file);
      return callback(null, file);
    });
  });

  builderChild.stdout.pipe(process.stdout);
};

Compiler.prototype.prepareBuild = function(query, callback) {
  let self = this;

  // this is less than ideal
  [self.paths.sketchBuild, self.paths.sketchLibs].forEach(function(dir, index) {
    mkdirp(dir, function (error) {
      if (error) console.log('couldn\'t create tmp dir:', error);
      // this is also less than ideal lol
      if (index === 1) {
        return callback(error);
      }
    });
  });
}

Compiler.prototype.depositFiles = function(query, callback) {
  /* libs sig
   "libraries":
    {
       "SPI":[
          {
             "filename":"SPI.h",
             "content":"content"
          },
          {
             "filename":"SPI.cpp",
             "content":"content"
          }
       ]
    },
  */
  let self = this;

  // do lib files
  if (query.libraries && Object.keys(query.libraries).length > 0) {
    let libraries = query.libraries;
    Object.keys(libraries).forEach(function(key) {
      // make lib dir to avoid file collisions from other libs
      mkdirp(libraries[key], function (error) {
        if (error) console.log('couldn\'t create tmp dir:', error);
        libraries[key].forEach(function(file) {
          let ws = fs.createWriteStream(path.join(self.paths.sketchLibs, libraries[key], file.filename));
          ws.write(file.content);
          console.log('create a new library file in:', self.paths.sketchLibs, libraries[key], file.filename);
        });
      });
    });
  } 

  // do sketch files
  if (query.files && query.files.length) {
    query.files.forEach(function(file) {
      let ws = fs.createWriteStream(path.join(self.paths.sketch, file.filename));
      ws.write(file.content);
      console.log('writing to file:', file.filename);
      // check if it's the main sketch file, so we can pass this on to the builder process
      if (file.filename.slice(-4) === '.ino') {
        self.sketchFile = file.filename;
        console.log('located sketch file:', self.sketchFile);
      }
    });
  }

  return callback(null);
}

Compiler.prototype.cleanUp = function(callback) {
  rimraf(this.paths.sketch, function() {
    return callback(null);
  });
}

module.exports = Compiler;
