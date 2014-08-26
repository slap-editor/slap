var _ = require('lazy.js');
var rc = require('rc');
var fs = require('fs');
var path = require('path');
var iconv = require('iconv-lite');

var Slap = require('./ui/Slap');
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
    "Example: `" + command + " --editor.tabSize 2 file.c`."
  ].join("\n"));

  return process.exit(0);
}

// Check if encoding is supported
if(!iconv.encodingExists(opts.editor.encoding)){
  // Failback to utf-8
  opts.editor.encoding = 'utf8';
}
logger(opts.logger);
highlightClient.send(_(opts.logger).merge({type: 'logger'}).toObject());
// Add additional file encodings
iconv.extendNodeEncodings();
var slap = new Slap(opts);

var homeRc = Slap.normalizePath('~/.' + package.name + 'rc');
if (opts._.length) {
  slap.open("" + opts._[0]).done();
} else if (!fs.existsSync(homeRc)) {
  slap.open(path.join(baseDir, 'README.md')).done();
}
fs.openSync(homeRc, 'a'); // touch

module.exports = slap;
