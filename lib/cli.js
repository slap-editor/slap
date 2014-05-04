var rc = require('rc');
var fs = require('fs');
var path = require('path');

var Slap = require('./slap');

var opts = rc(require('../package').name);
var slap = new Slap(opts);

var homeSlapRc = Slap.normalizePath('~/.slaprc');
if (opts._.length) {
  slap.open("" + opts._[0]).done();
} else if (!fs.existsSync(homeSlapRc)) {
  slap.open(path.join(__dirname, '..', 'README.md')).done();
}
fs.openSync(homeSlapRc, 'a'); // touch

module.exports = slap;
