var rc = require('rc');
var fs = require('fs');
var path = require('path');
var winston = require('winston');

var Slap = require('./ui/Slap');
var util = require('./util');

var baseDir = path.join(__dirname, '..');
var packageName = require('../package').name;
var opts = util.parseOpts(rc(packageName, path.join(baseDir, packageName + '.ini')));

winston
  .add(winston.transports.File, {
    filename: packageName + '.log',
    level: opts.logLevel || 'info',
    handleExceptions: true,
    exitOnError: false
  })
  .remove(winston.transports.Console);
var levels = winston.config.npm.levels;
if (levels[opts.logLevel] < levels.info) require('longjohn');

var slap = new Slap(opts);

var homeSlapRc = Slap.normalizePath('~/.slaprc');
if (opts._.length) {
  slap.open("" + opts._[0]).done();
} else if (!fs.existsSync(homeSlapRc)) {
  slap.open(path.join(baseDir, 'README.md')).done();
}
fs.openSync(homeSlapRc, 'a'); // touch

module.exports = slap;
