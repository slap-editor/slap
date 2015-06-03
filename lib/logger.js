var path = require('path');
var winston = require('winston');
var fs = require('fs');

var packageName = require('../package').name;

function logger (opts) {
  var logFile = path.join(opts.dir || '.', opts.filename || packageName + '.log');
  logger.stream = fs.createWriteStream(logFile, {flags: 'a'});
  var winstonLogger = new winston.Logger({
    exitOnError: false,
    transports: [
      new winston.transports.File({
        stream: logger.stream,
        level: opts.level || 'info',
        handleExceptions: true,
        json: false,
        prettyPrint: true,
        colorize: true
      })
    ]
  });

  var levels = winston.config.npm.levels;
  if (levels[opts.level] > levels.debug) {
    console._error = console.error;
    console.error = function () {
      return logger.stream.write([].join.call(arguments, ' ') + '\n');
    };
  } else {
    require('longjohn');
    require('bluebird').longStackTraces();
  }

  winstonLogger.extend(logger);
}

module.exports = logger;
global.logger = logger;
