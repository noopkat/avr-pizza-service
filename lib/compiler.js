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
const async = require('async');
const legacyBoards = require('./legacyBoards');

function Compiler(request) {
  // request details
  this.request = request;
  this.payload = this.request.payload.pipe(gunzip());
  this.version = this.request.headers['x-version'] || '16800';
  this.board = this.request.headers['x-board'] || 'uno';
  this.sketchFile = 'sketch.ino';

  // rename legacy boards to match platform io ids
  if (legacyBoards[this.board]) {
    this.board = legacyBoards[this.board];
  }

  // create a unique id for this instance for dir naming
  this.id = uuid.v1();

  const sketchBasePath = path.join(os.homedir(), '.avrpizza', this.id);

  // eventually these should be json / env prefs
  this.paths = {
    sketch: path.join(sketchBasePath, 'sketch'),
    sketchLibs: path.join(sketchBasePath, 'libs'),
    sketchBuild: path.join(sketchBasePath, '.pioenvs', this.board),
    sketchBase: sketchBasePath
  };
}

Compiler.prototype.compile = function(callback) {
  const self = this;

  async.waterfall(
    [
      self.prepareBuild.bind(self),
      self.depositFiles.bind(self),
      self.buildSketch.bind(self)
    ],
    function(error, hex) {
      self.cleanUp();
      return callback(error, hex);
    }
  );
}

Compiler.prototype.buildSketch = function(callback) {
  const self = this;

  // build platformio command sequence
  const builderString = [
    `mv ${self.paths.sketchLibs} ${self.paths.sketchBase}/lib`, // for backwards compatibility with old avr-pizza versions
    `mv ${self.paths.sketch} ${self.paths.sketchBase}/src`, // for backwards compatibility with old avr-pizza versions
    `pio init -d ${self.paths.sketchBase} -b ${self.board}`,
    `pio run --silent -d ${self.paths.sketchBase}`
  ].join(' && ');

  // run Arduino Builder in a child process 
    const builderChild = child.exec(builderString, function(error) {
    // something went wrong
    if (error) {
      // log
      console.error(new Date(), error);
      
      // scrub error message
      const escapedSketchPath = self.paths.sketchBase.replace(/\\/g, '\\\\');
      const re = new RegExp(escapedSketchPath, 'ig');
      const errorStart = error.message.split('\n').slice(1, -3).join('\n');
      const errorClean = errorStart.replace(re, '');

      return callback(errorClean);
    }

    // log this
    console.log(new Date(), 'successful compilation completed for ' + self.board);

    fs.readFile(path.join(self.paths.sketchBuild, 'firmware.hex'), function(error, file) {
      return callback(null, file);
    });
  });

  // we wanna see what details in the logs
  builderChild.stdout.pipe(process.stdout);
};

Compiler.prototype.prepareBuild = function(callback) {
  const self = this;

  // create temporary directory for compilation to be performed in
  mkdirp(self.paths.sketchBase, function (error) {
    return callback(error);
  });
}

Compiler.prototype.depositFiles = function(callback) {
  const self = this;
  const extract = tar.extract();

  extract.on('entry', function(header, stream, callback) {
    const locationPath = path.join(self.paths.sketchBase, header.name);

    // if the entry is a directory, simply create the directory
    if (header.type === 'directory') {
      mkdirp(locationPath, callback);
      stream.resume();
    } 

    // if the entry is a file, we have to save it to disk
    else if (header.type === 'file') {
      const dirPath = path.join(self.paths.sketchBase, path.dirname(header.name));

      // create the directory for the file first
      mkdirp(dirPath, function(error) {
        if (error) return callback(error);
        // create write stream for entry file
        const ws = fs.createWriteStream(locationPath);
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
    return callback(null);
  });

  // start extracting!
  this.payload.pipe(extract);
}

Compiler.prototype.cleanUp = function(callback) {
  // delete all the things
  rimraf(this.paths.sketchBase, function() {
    if (callback) return callback(null);
  });
}

module.exports = Compiler;
