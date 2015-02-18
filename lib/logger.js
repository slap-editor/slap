var path = require('path');
var winston = require('winston');
var fs = require('fs');

var packageName = require('../package').name;

function logger (opts) {
  var logFile = path.join(opts.dir || '.', opts.filename || packageName + '.log');
  logger.stream = fs.createWriteStream(logFile);
  var winstonLogger = new winston.Logger({
    transports: [
      new winston.transports.File({
        stream: logger.stream,
        level: opts.level || 'info',
        handleExceptions: true,
        exitOnError: false,
        json: false,
        prettyPrint: true,
        colorize: true
      })
    ]
  });

  var levels = winston.config.npm.levels;
  if (levels[opts.level] < levels.info) {
    require('longjohn');
    require('bluebird').longStackTraces();
  }

  winstonLogger.extend(logger);
}

var _consoleError = console.error;
console.error = function () {
  if (!logger.stream) return _consoleError.apply(this, arguments);
  return logger.stream.write([].join.call(arguments, ' ') + '\n');
};

module.exports = logger;
global.logger = logger;
