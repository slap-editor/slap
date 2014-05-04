var argv = require('optimist')
  .usage("Usage: $0 [options] <file>")
  .argv;
var rc = require('rc');
var fs = require('fs');
var path = require('path');

var packageJSON = require('../package');
var Slap = require('./slap');

var slap = new Slap(rc(packageJSON.name, argv));

var homeSlapRc = Slap.normalizePath('~/.slaprc');
if (argv._.length) {
  slap.open(argv._[0]);
} else if (!fs.existsSync(homeSlapRc)) {
  slap.open(path.join(__dirname, '..', 'README.md'));
}
fs.openSync(homeSlapRc, 'a'); // touch

module.exports = slap;
