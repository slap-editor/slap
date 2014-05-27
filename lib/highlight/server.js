#!/usr/bin/env node

var markup = require('../markup');
var textUtil = require('../textUtil');
var logger = require('../logger');

process.on('message', function (message) {
  switch (message.type) {
    case 'logger':
      logger(message);
      break;
    case 'highlight':
      process.send({
        lines: textUtil.splitLines(markup.highlight(message.text, message.language, message.style)),
        revision: message.revision,
        bucket: message.bucket
      });
      break;
  }
});
