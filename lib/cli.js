var _ = require('lazy.js');
var path = require('path');
var rc = require('rc');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));

var Slap = require('./ui/Slap');
var Pane = require('./ui/Pane');
var util = require('./util');
var logger = require('./logger');
var highlightClient = require('./highlight/client');

var baseDir = path.join(__dirname, '..');
var package = require('../package');
var configFile = path.join(baseDir, package.name + '.ini');
var opts = util.parseOpts(rc(package.name, configFile));

if (opts.h || opts.help) {
  var command = process.argv[1];
  if (!process.env.PATH.split(path.delimiter).some(function (binPath) {
    var newCommand = path.relative(binPath, command);
    if (path.dirname(newCommand) === '.') {
      command = newCommand;
      return true;
    }
  })) {
    command = path.relative(process.cwd(), command);
    if (path.dirname(command) === '.') command = '.' + path.sep + command;
  }

  console.error([
    "Usage: " + command + " [options...] [file]",
    "",
    package.description,
    "",
    "To see what options are available, run `" + command + " " + configFile + "`.",
    "Example: `" + command + " --logger.level debug file.c`."
  ].join("\n"));

  return process.exit(0);
}

module.exports = util.getUserDir()
  .catch(function (err) {})
  .then(function (userDir) {
    logger(_(userDir ? {dir: userDir} : {}).merge(opts.logger).toObject());

    process._debugPort = 5140;
    highlightClient.send({type: 'debugPort', port: process._debugPort + 1});
    highlightClient.send({type: 'logger', options: opts.logger});

    logger.info('starting...');
    logger.verbose('configuration:', opts);
    var slap = new Slap(opts);

    Promise.all(opts._.map(function (path, i) { return slap.open(path.toString(), !i); })).done();

    if (!opts._.length) { // if no files are passed
      new Pane().setCurrent(); // open a new empty file
      if (!opts.config) { // first run without a file passed
        slap.open(path.join(baseDir, 'README.md'), true).done();
        fs.openAsync(path.join(userDir, 'config'), 'a'); // touch user config file if it doesn't exist
      }
    }

    return slap;
  });
