var _ = require('lodash');
var path = require('path');
var rc = require('rc');

var util = require('slap-util');
var ttys = require('ttys');
var package = require('../package');
var baseDir = path.join(__dirname, '..');
var configFile = path.join(baseDir, package.name + '.ini');
var opts = util.parseOpts(rc(package.name, configFile));
opts = _.merge(opts, opts.slap);

var info = console._error || console.error;

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

  info([
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
  var SORT_ORDER = ['slap', 'node', 'v8'].reverse();
  var versions = _.clone(process.versions);
  versions[package.name] = package.version;
  info(Object.keys(versions)
    .sort(function (a, b) { return SORT_ORDER.indexOf(b) - SORT_ORDER.indexOf(a); })
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

try {
  var Promise = require('bluebird');
} catch (e) {
  if (e instanceof ReferenceError) {
    global.Promise = require('bluebird');
  } else {
    throw e;
  }
}

var fs = Promise.promisifyAll(require('fs'));

var blessed = require('base-widget').blessed;
var Slap = require('./ui/Slap');
var EditorPane = require('./ui/EditorPane');

function readAsync (stream) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    stream
      .on('error', reject)
      .on('data', chunks.push.bind(chunks))
      .on('end', function () { resolve(Buffer.concat(chunks)); });
  });
}

module.exports = function (options) {
  opts = _.merge(opts, options);
  return Promise.all([
    Slap.getUserDir().catch(Promise.resolve()),
    process.stdin.isTTY ? Promise.resolve() : readAsync(process.stdin) // read pipe to stdin into a new file if there is one
  ]).spread(function (userDir, stdin) {
    if (userDir) opts = _.merge({logger: {file: path.resolve(userDir, package.name+'.log')}}, opts);
    opts = _.merge({editor: {logger: opts.logger}}, opts);
    opts.screenOpts.input = ttys.stdin; // Uses ttys to read from /dev/tty
    util.logger(opts.logger);
    util.logger.info("loading...");
    util.logger.verbose("configuration:", opts);

    if (!opts.config) fs // if a user config doesn't exist, make one by copying a template
      .createReadStream(path.join(__dirname, '..', 'default-config.ini'))
        .pipe(fs.createWriteStream(path.join(userDir, 'config')));

    if (!opts.screen) opts.screen = new blessed.Screen(opts.screenOpts);
    opts.screen.logger = opts.logger;
    var slap = new Slap(opts);

    Promise.all(opts._.map(function (path, i) {
      return slap.open(path.toString(), !i);
    })).done();

    if (stdin || !opts._.length) { // if no files are passed
      var pane = new EditorPane({parent: slap});
      // Sets stdin from pipe if it exists
      if (stdin) pane.editor.textBuf.setText(stdin.toString());
      pane.setCurrent();
    }

    require('update-notifier')({pkg: package}).notify();

    return slap.ready.disposer(function (slap) { slap.quit(); });
  });
};
