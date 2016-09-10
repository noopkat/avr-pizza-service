'use strict';

const child = require('child_process');
const path = require('path');
const fs = require('fs');
const uuid = require('node-uuid');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const os = require('os');
const tar = require('tar-stream');
const gunzip = require('gunzip-maybe');

function Compiler(request) {
  // request details
  this.request = request;
  this.payload = this.request.payload.pipe(gunzip());
  this.version = this.request.headers['x-version'] || '16800';
  this.board = this.request.headers['x-board'] || 'uno';
  this.sketchFile = 'sketch.ino';
  this.manufacturer = this.request.headers['x-manufacturer'] || 'arduino';
  this.arch = this.request.headers['x-arch'] || 'avr';

  // create a unique id for this instance for dir naming
  this.id = uuid.v1();

  let binBasePath = path.join(__dirname, '..', 'bin', 'builder', 'arduino-1.6.9');
  let sketchBasePath = path.join('/', 'tmp', 'avrpizza', this.id);

  // eventually these should be json / env prefs
  this.paths = {
    arduinoBuilder: path.join(binBasePath, 'arduino-builder'),
    libraries: path.join(binBasePath, 'libraries'),
    hardware: path.join(binBasePath, 'hardware'),
    tools: path.join(binBasePath, 'hardware', 'tools', 'avr'),
    builder_tools: path.join(binBasePath, 'tools-builder'),
    sketch: path.join(sketchBasePath, 'sketch'),
    sketchLibs: path.join(sketchBasePath, 'libs'),
    sketchBuild: path.join(sketchBasePath, 'dist'),
    sketchBase: sketchBasePath
  };
}

Compiler.prototype.compile = function(callback) {
  let self = this;

  // TODO it's async taim I think
  self.prepareBuild(function(error) {
    if (error) return callback(error);
    self.depositFiles(self.payload, function(error) {
      if (error) return callback(error);
      self.buildSketch(function(error, hex) {
      if (error) {
        self.cleanUp(function(){});
        return callback(error);
      }
       self.cleanUp(function(error) {
          return callback(error, hex);
        });
      });
    });
  });
}

Compiler.prototype.buildSketch = function(callback) {
  let self = this;

  // assemble all options and flags for Arduino Builder based on the facts
  let builderString = [
    '-compile',
    `-hardware="${self.paths.hardware}"`,
    `-tools="${self.paths.tools}"`,
    `-tools="${self.paths.builder_tools}"`,
    `-fqbn="${self.manufacturer}:${self.arch}:${self.board}"`,
    `-built-in-libraries="${self.paths.libraries}"`,
    `-libraries="${self.paths.sketchLibs}"`,
    `-ide-version=${self.version}`,
    `-build-path="${self.paths.sketchBuild}"`,
    '-logger=human',
    '-debug-level=1',
    '-warnings=none',
    path.join(self.paths.sketch, self.sketchFile)
  ].join(' ');

  // run Arduino Builder in a child process (yay cmd line apps)
  let builderChild = child.exec(`${self.paths.arduinoBuilder} ${builderString}`, function(error) {
    // something went wrong
    if (error) {
      // log
      console.error(new Date(), error);
      
      // scrub error message
      var re = new RegExp(self.paths.sketchBuild, 'ig');
      var errorline = error.message.split('/sketch/sketch.ino').slice(1).join('');
      var errorline = errorline.replace(re, '');

      return callback(errorline);
    }

    console.log(new Date(), 'successful compilation completed for ' + self.board);

    fs.readFile(path.join(self.paths.sketchBuild, `${self.sketchFile}.hex`), function(error, file) {
      return callback(null, file);
    });
  });

  // we wanna see what happened in the logs
  builderChild.stdout.pipe(process.stdout);
};

Compiler.prototype.prepareBuild = function(callback) {
  let self = this;

  // create temporary directory for compilation to be performed in
  mkdirp(self.paths.sketchBase, function (error) {
    return callback(error);
  });
}

Compiler.prototype.depositFiles = function(payload, callback) {
  let self = this;
  let extract = tar.extract();

  extract.on('entry', function(header, stream, callback) {
    let locationPath = path.join(self.paths.sketchBase, header.name);

    // if the entry is a directory, simply create the directory
    if (header.type === 'directory') {
      mkdirp(locationPath, callback);
      stream.resume();
    } 

    // if the entry is a file, we have to save it to disk
    else if (header.type === 'file') {
      let dirPath = path.join(self.paths.sketchBase, path.dirname(header.name));

      // create the directory for the file first
      mkdirp(dirPath, function(error) {
        if (error) return callback(error);
        // create write stream for entry file
        let ws = fs.createWriteStream(locationPath);
        // write file
        stream.pipe(ws);

        stream.on('end', function() {
        // ready for next entry
         callback(null); 
        });
      });
    }
  });

  extract.on('finish', function() {
    // we're done.
    callback(null);
  });

  // start extracting!
  payload.pipe(extract);
}

Compiler.prototype.cleanUp = function(callback) {
  // delete all the things
  rimraf(this.paths.sketchBase, function() {
    return callback(null);
  });
}

module.exports = Compiler;
