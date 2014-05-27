var winston = require('winston');
require('bluebird').longStackTraces();

var packageName = require('../package').name;

function logger (opts) {
  var winstonLogger = new winston.Logger({
    transports: [
      new winston.transports.File({
        filename: packageName + '.log',
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
  if (levels[opts.level] < levels.info) require('longjohn');

  winstonLogger.extend(logger);
}

module.exports = logger;
