#!/usr/bin/env node

var markup = require('../markup');
var textUtil = require('../textUtil');
var logger = require('../logger');

process.on('message', function (message) {
  switch (message.type) {
    case 'highlight':
      process.send({
        ranges: markup.highlight(message.text, message.language),
        revision: message.revision,
        bucket: message.bucket
      });
      break;
    case 'logger': logger(message.options); break;
  }
});
