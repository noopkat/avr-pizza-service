'use strict';

const Hapi = require('hapi');
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
    path: '/.well-known/{param*}',
    handler: {
        directory: {
            path: '.well-known'
        }
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
      let builder = new Compiler(request);
      builder.compile(function(error, hex) {
        var hexJson = JSON.stringify(hex);
        var response = {
          data: {
            type: 'hex',
            src: JSON.parse(hexJson).data
          }
        }
        reply(response);
     });
    },
    config: {
      payload: {
        output: 'stream',
        parse: false
      }
    }
  });
});

server.start((err) => {
  if (err) {
    throw err;
  }
  console.log('Server running at:', server.info.uri);
});
