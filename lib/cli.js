var rc = require('rc');
var fs = require('fs');
var path = require('path');

var Slap = require('./slap');

var baseDir = path.join(__dirname, '..');
var opts = rc(require('../package').name, path.join(baseDir, '.slaprc'));
var slap = new Slap(opts);

var homeSlapRc = Slap.normalizePath('~/.slaprc');
if (opts._.length) {
  slap.open("" + opts._[0]).done();
} else if (!fs.existsSync(homeSlapRc)) {
  slap.open(path.join(baseDir, 'README.md')).done();
}
fs.openSync(homeSlapRc, 'a'); // touch

module.exports = slap;
