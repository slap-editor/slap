var _ = require('lazy.js');
var path = require('path');
var rc = require('rc');

var util = require('./util');
var package = require('../package');
var baseDir = path.join(__dirname, '..');
var configFile = path.join(baseDir, package.name + '.ini');
var opts = util.parseOpts(rc(package.name, configFile));
opts = _(opts).merge(opts.slap).toObject();

// special invocation modes
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
    "Usage: " + command + " [options...] [<file1> [<file2> [...]]]",
    "",
    package.description,
    "",
    "To see what options are available, run `" + command + " " + configFile + "`.",
    "Example: `" + command + " --logger.level debug file.c`."
  ].join("\n"));

  return process.exit(0);
}

if (opts.v || opts.version) {
  var SORT_ORDER = ['slap', 'node', 'v8'];
  var versions = process.versions;
  versions[package.name] = package.version;
  console.error(Object.keys(versions)
    .sort(function (a, b) {
      var sa = SORT_ORDER.indexOf(a); if (sa < 0) return 1;
      var sb = SORT_ORDER.indexOf(b); if (sb < 0) return -1;
      return sa - sb;
    })
    .map(function (name) { return name+"@"+versions[name]; })
    .join(", "));
  return process.exit(0);
}

if (opts.perf.profile && process.execArgv.indexOf('--prof') === -1) {
  var cp = require('child_process').fork(process.argv[1], process.argv.slice(2), {
    stdio: 'inherit',
    execArgv: ['--prof'].concat(process.execArgv)
  });
  cp.on('exit', function (code) { process.exit(code); });
  cp.on('error', function (err) { process.exit(8); });
  return;
}

var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var iconv = require('iconv-lite');

var logger = require('./logger');
var highlightClient = require('./highlight/client');
var Slap = require('./ui/Slap');
var Pane = require('./ui/Pane');

module.exports = function (options) {
  opts = _(opts).merge(options || {}).toObject();
  return util.getUserDir().catch(Promise.resolve()).then(function (userDir) {
    opts.logger = _(userDir ? {dir: userDir} : {}).merge(opts.logger).toObject();

    logger(opts.logger);
    highlightClient.call('send', {type: 'logger', options: opts.logger}).done();

    iconv.extendNodeEncodings();

    logger.info('starting...');
    logger.verbose('configuration:', opts);
    var slap = new Slap(opts);

    Promise.all(opts._.map(function (path, i) {
      return slap.open(path.toString(), !i);
    })).done();

    if (!opts._.length) { // if no files are passed
      new Pane().setCurrent(); // open a new empty file
      if (!opts.config) { // first run without a file passed
        slap.open(path.join(baseDir, 'README.md'), true)
          .tap(function (pane) { pane.editor.readOnly(true); })
          .done();
        fs.createReadStream(path.join(__dirname, '..', 'default-config.ini')).pipe(fs.createWriteStream(path.join(userDir, 'config')));
      }
    }

    require('update-notifier')({pkg: package}).notify();

    return slap.ready.disposer(function (slap) { slap.quit(); });
  });
};
