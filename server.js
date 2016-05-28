'use strict';

const Hapi = require('hapi');
const request = require('request');
const http = require('http');
const querystring = require('querystring');
const path = require('path');
const fs = require('fs');
const Compiler = require('./lib/compiler');

const server = new Hapi.Server();
server.connection({ port: 3000 });

server.register(require('inert'), (err) => {

  if (err) {
    throw err;
  }

  server.route({
    method: 'GET',
    path: '/',
    handler: function (request, reply) {
      reply.file('./public/index.html');
    }
  });

  server.route({
    method: 'GET',
    path: '/auth/v1',
    handler: function (request, reply) {
      // generate a token
      // save in db
      // reply with token
      reply.file('./public/index.html');
    }
  });

  server.route({
    method: 'POST',
    path: '/compile/v1',
    handler: function (request, reply) {
      let builder = new Compiler();
      builder.compile(request, function(error, hex) {
        reply({hex: hex});
      });
    }
  });
});



/* test request */
server.start((err) => {
  if (err) {
    throw err;
  }
  console.log('Server running at:', server.info.uri);
  // let dummyfile = path.join(__dirname, 'dummy','sketches','Firmata','examples','StandardFirmata','StandardFirmata.ino');
  let dummyfile = path.join(__dirname, 'dummy','sketches','Blink','blink.ino');

  fs.readFile(dummyfile, {encoding: 'utf8'}, function(error, file) {
    let data = JSON.stringify({
      files: [
        {
          filename: 'sketch.ino',
          content: file
        }
      ],
      board: 'uno',
      libraries: {},
      version: '16900'
    });

    let jsonData = querystring.stringify(data);
    // console.log(jsonData);

    var options = {
      hostname: 'localhost',
      path: `/compile/v1`,
      port: 3000,
      method : 'POST',
      headers: {'User-Agent': 'avrpizza', 'Accept': 'application/json'}
    };

    var reqGet = http.request(options, function(res) {
      var datastring = '';
      res.on('data', function(d) {
          datastring += d;
      });

      res.on('end', function() {
        // done
        console.log('sent request in full:', datastring);
      }); 
    });

    reqGet.on('error', function(e) {
      return reply('everything is sad: '+e);
    }); 

    reqGet.write(data);
    reqGet.end();
    
  });
});
