var argv = require('optimist')
  .usage("Usage: $0 [options] <file>")
  .demand(1)
  .argv;
var rc = require('rc');
var extend = require('xtend');

var packageJSON = require('../package');
var Program = require('./program');

var program = new Program(rc(packageJSON.name, argv));

program.open(argv._[0]);
