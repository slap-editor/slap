var argv = require('optimist')
  .usage("Usage: $0 [options] <file>")
  .argv;
var rc = require('rc');

var packageJSON = require('../package');
var Slap = require('./slap');

var slap = new Slap(rc(packageJSON.name, argv));

if (argv._.length) {
  slap.open(argv._[0]);
}
