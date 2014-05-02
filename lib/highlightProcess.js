#!/usr/bin/env node

var markup = require('./markup');

process.on('message', function (data) {
  process.send(markup.highlight(data.text, data.language, data.style));
});
