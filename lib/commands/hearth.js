'use strict';

const hearth = require('../api');
const WS = require('../models/ws');
const finalhandler = require('finalhandler');
const http = require('http');
const serveStatic = require('serve-static');
const Promise = require('bluebird');
const path = require('path');

function startHearthWebServer(port) {
  return new Promise(resolve => {
// Serve up public/ftp folder
    var serve = serveStatic(path.join(__dirname, '..', '..', 'web'));

// Create server
    var server = http.createServer(function (req, res) {
      var done = finalhandler(req, res);
      serve(req, res, done);
      resolve();
    });

// Listen
    server.listen(port);
  });
}

module.exports = {
  name: 'hearth',
  description: 'starts the hearth server + socket',

  availableOptions: [
    {
      name: 'environment',
      type: String,
      default: 'development',
      aliases: ['e', {'dev': 'development'}, {'prod': 'production'}]
    },
    {name: 'host', type: String, default: '::'},
    {name: 'socket-port', type: Number, default: 4202},
    {name: 'web-port', type: Number, default: 4201}
  ],

  runCommand: function (appName, options) {
    var commandOptions = this.commandOptions;
    const host = commandOptions.host;
    const webPort = commandOptions.webPort;
    const socketPort = commandOptions.socketPort;
    var ui = this.ui;

    ui.writeLine("Starting hearth websocket", socketPort);

    // TODO: start hearth app server

    const ws = new WS({
      port: socketPort,
      project: this.project,
      host: host.host,
      ui
    });

    const mapping = {
      'hearth-ready': 'emitProjects',
      'hearth-run-cmd': 'runCmd',
      'hearth-kill-cmd': 'killCmd'
    };

    Object.keys(mapping).forEach((evName) => {
      ws.on(evName, (ws, data) => {
        console.log('ipc', evName, ...data);
        hearth[mapping[evName]](ws, ...data);
      });
    });

    ui.writeLine("Starting hearth web server", webPort);

    return Promise.all([
      startHearthWebServer(webPort)
    ]).then(() => {
      // Block forever
      return new Promise(function () {});
    });
  },

  run: function (options, args) {
    this.commandOptions = options;

    var runCommand = function () {
      var appName = process.env.EMBER_CLI_HEARTH_APP_NAME || this.project.name();

      return this.runCommand(appName, options);
    }.bind(this);

    if (options.build) {
      return this.triggerBuild(options)
        .then(runCommand);
    }

    return runCommand();
  }
};
