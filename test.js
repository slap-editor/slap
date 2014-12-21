#!/usr/bin/env node

var winston = require('winston');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));

var logger = new winston.Logger({
  transports: [
    new winston.transports.File({
      filename: 'test.log',
      level: 'silly',
      handleExceptions: true,
      exitOnError: false,
      json: false,
      prettyPrint: true,
      colorize: true
    })
  ]
});

fs.readFileAsync('test.js')
  .tap(function () { logger.warn('not logging'); })
  .done();
