'use strict';

const Promise = require('bluebird');
const jsonminify = require("jsonminify");
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const term = require('./models/term').forPlatform();
const escapeStringRegexp = require('escape-string-regexp');

let processes = {},
  binaries = {
    ember: (ev) => path.join(ev.project.nodeModulesPath, 'ember-cli', 'bin', 'ember'),
    npm: (ev) => path.join(ev.project.nodeModulesPath, 'npm', 'bin', 'npm-cli.js')
  };


function pathToBinary(ev, bin) {
  return binaries[bin](ev);
}

function addMetadata(project) {
  // get some app metadata (could probably be cached, but avoids old entries if stored in db on add)
  console.log('stat', path.resolve(project.data.attributes.path, '.ember-cli'));
  const packagePath = path.resolve(project.data.attributes.path, 'package.json');
  const cliPath = path.resolve(project.data.attributes.path, '.ember-cli');

  return Promise.props({
    'package': fs.statAsync(packagePath),
    'cli': fs.statAsync(cliPath)
  }).then((stats) => {
    return Promise.props({
      cli: stats.cli.isFile() && fs.readFileAsync(cliPath),
      'package': stats.package.isFile() && fs.readFileAsync(packagePath)
    }).then(data => {
      if (data.package) project.data.attributes.package = JSON.parse(data.package);
      if (data.cli) project.data.attributes.cli = JSON.parse(jsonminify(data.cli.toString('utf8')));

      // TODO: read default ports
      if (!project.data.attributes.cli) project.data.attributes.cli = {};
      if (!project.data.attributes.cli.testPort) project.data.attributes.cli.testPort = 7357;
      if (!project.data.attributes.cli.port) project.data.attributes.cli.port = 4200;

      return project;
    });
  });
}

function projectToData(project) {
  return addMetadata({
    data: {
      id: project.root.replace(new RegExp(escapeStringRegexp(path.sep), 'g'), '_'),
      type: 'project',
      attributes: {
        name: path.basename(project.root),
        path: project.root,
        'package': project.pkg
      }
    }
  });
}

function emitProjects(ev) {
  return projectToData(ev.project).then((project) => {
    // send jsonapi list of apps
    ev.send('project-list', {
      data: [project.data]
    });
  });
}

function runCmd(ev, cmd) {
  const cmdData = cmd.data;
  return projectToData(ev.project).then(project => {
    let args = [cmdData.attributes.name].concat(cmdData.attributes.args),
      cmdPromise;

    if (cmdData.attributes.options) {
      Object.keys(cmdData.attributes.options).forEach(optionName =>
        args.push(`--${optionName}`, cmdData.attributes.options[optionName]));
    }

    if (cmdData.attributes['in-term']) {
      cmdPromise = term.launchTermCommand(pathToBinary(ev, cmdData.attributes.bin), args, {
        cwd: path.normalize(project.data.attributes.path)
      });
    } else {
      cmdPromise = Promise.resolve(term.spawn(pathToBinary(ev, cmdData.attributes.bin), args, {
        cwd: path.normalize(project.data.attributes.path)
      }));
    }

    return cmdPromise.then((cmd) => {
      cmd.stdout.on('data', (data) => {
        ev.send('cmd-stdout', {cmd: cmdData, stdout: data.toString('utf8')});
        console.log(`cmd ${args} stdout: ${data}`);
      });
      cmd.stderr.on('data', (data) => {
        ev.send('cmd-stderr', {cmd: cmdData, stderr: data.toString('utf8')});
        console.log(`cmd ${args} stderr: ${data}`);
      });
      cmd.on('close', (code) => {
        delete processes[cmdData.id];
        ev.send('cmd-close', {cmd: cmdData, code});
        console.log(`cmd ${args} child process exited with code ${code}`);
      });
      ev.send('cmd-start', {cmd: cmdData});
      processes[cmdData.id] = cmd;
    });
  });
}

function killCmd(ev, cmd) {
  if (processes[cmd.data.id]) {
    processes[cmd.data.id].kill();
  }
}

function killAllProcesses() {
  Object.keys(processes).forEach(processId =>
    processes[processId].kill());
}

module.exports = {
  runCmd,
  killCmd,
  emitProjects,
  killAllProcesses
};
