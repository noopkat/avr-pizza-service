'use strict';

const Hapi = require('hapi');
const Compiler = require('./lib/compiler');
const port = process.env.PORT || 3000;
const server = new Hapi.Server();
server.connection({ port: port });

server.register(require('inert'), function(err) {

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
      reply.file('./public/index.html');
    }
  });

  server.route({
    method: 'POST',
    path: '/compile/v1',
    handler: function (request, reply) {
      let builder = new Compiler(request);
      builder.compile(function(error, hex) {
        const hexJson = JSON.stringify(hex);
        let response, code;
        
        if (error) {
          code = 400;
          response = {
            error: error
          }
        } else {
          code = 200;
          response = {
            data: {
              type: 'hex',
              src: JSON.parse(hexJson).data
            }
          }
        }
        // reply with appropriate response and code
        reply(response).code(code);
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

server.start(function(err) {
  if (err) {
    throw err;
  }
  console.log('Server running at:', server.info.uri);
});
