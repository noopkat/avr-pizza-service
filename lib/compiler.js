'use strict';

const child = require('child_process');
const path = require('path');
const fs = require('fs');
const uuid = require('node-uuid');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const os = require('os');
const tar = require('tar-stream');

function Compiler() {
  // create a unique id for this instance for dir naming
  this.id = uuid.v1();

  let binBasePath = path.join(__dirname, '..', 'bin', 'builder', 'arduino-1.6.9');
  let sketchBasePath = path.join(os.homedir(), '.avrpizza', 'tmp', this.id);

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
    '-compile',
    '-logger=machine',
    `-hardware="${self.paths.hardware}"`,
    `-tools="${self.paths.tools}"`,
    `-tools="${self.paths.builder_tools}"`,
    `-fqbn="arduino:avr:${board}"`,
    `-built-in-libraries="${self.paths.libraries}"`,
    `-libraries="${self.paths.sketchLibs}"`,
    `-ide-version=${version}`,
    `-build-path="${self.paths.sketchBuild}"`,
    '-verbose',
    '-warnings=none',
    path.join(self.paths.sketch, self.sketchFile)
  ].join(' ');

  let builderChild = child.exec([self.paths.arduinoBuilder, builderString].join(' '), function(error) {
    console.log('compilation completed.', console.log(error));
    fs.readFile(path.join(self.paths.sketchBuild, `${self.sketchFile}.hex`), function(error, file) {
      //console.log(error, file);
      return callback(null, file);
    });
  });

  builderChild.stdout.pipe(process.stdout);
};

Compiler.prototype.prepareBuild = function(query, callback) {
  let self = this;

  mkdirp(self.paths.sketchBase, function (error) {
    if (error) console.log('couldn\'t create tmp dir:', error);
    return callback(error);
  });

  // make this dynamic on the client side
  self.sketchFile = 'sketch.ino';
}

Compiler.prototype.depositFiles = function(query, callback) {
  var self = this;

  var extract = tar.extract();

  extract.on('entry', function(header, stream, callback) {
    console.log(header);
    if (header.type === 'directory') {
      mkdirp(path.join(self.paths.sketchBase, header.name), callback);
      stream.resume();
    } else if (header.type === 'file') {
      mkdirp(path.join(self.paths.sketchBase, path.dirname(header.name)), function(error) {
        var ws = fs.createWriteStream(path.join(self.paths.sketchBase, header.name));
        stream.pipe(ws);
        stream.on('end', function() {
         callback(); // ready for next entry
        });
      });
    }
  });

  extract.on('finish', function() {
    callback(null)
  });

  query.pipe(extract);
}

Compiler.prototype.cleanUp = function(callback) {
  rimraf(this.paths.sketchBase, function() {
    return callback(null);
  });
}

module.exports = Compiler;
