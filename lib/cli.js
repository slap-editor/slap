var _ = require('lazy.js');
var rc = require('rc');
var fs = require('fs');
var path = require('path');

var Slap = require('./ui/Slap');
var util = require('./util');
var logger = require('./logger');
var highlightClient = require('./highlight/client');

var baseDir = path.join(__dirname, '..');
var packageName = require('../package').name;
var opts = util.parseOpts(rc(packageName, path.join(baseDir, packageName + '.ini')));

logger(opts.logger);
highlightClient.send(_(opts.logger).merge({type: 'logger'}).toObject());
var slap = new Slap(opts);

var homeSlapRc = Slap.normalizePath('~/.slaprc');
if (opts._.length) {
  slap.open("" + opts._[0]).done();
} else if (!fs.existsSync(homeSlapRc)) {
  slap.open(path.join(baseDir, 'README.md')).done();
}
fs.openSync(homeSlapRc, 'a'); // touch

module.exports = slap;
