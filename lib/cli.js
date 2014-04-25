var argv = require('optimist')
  .usage("Usage: $0 [options] <file>")
  .argv;
var rc = require('rc');
var extend = require('xtend');

var packageJSON = require('../package');
var Program = require('./program');

var program = new Program(rc(packageJSON.name, argv));

if (argv._.length) {
  program.open(argv._[0]);
}
