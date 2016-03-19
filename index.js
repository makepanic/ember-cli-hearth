/* jshint node: true */
'use strict';

const express = require('express');

const hearth = require('./lib/api');
const WS = require('./lib/models/ws');

module.exports = {
  name: 'ember-cli-hearth',

  serverMiddleware(config){
    const options = config.options;
    const app = config.app;
    const socketPort = options.port + 1;
    const ui = options.ui;

    app.use('/hearth', express.static('web'));

    const ws = new WS({
      port: socketPort,
      project: this.project,
      host: '::',
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
  }
};
