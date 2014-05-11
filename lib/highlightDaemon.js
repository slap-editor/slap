#!/usr/bin/env node

var markup = require('./markup');
var textUtil = require('./textUtil');

process.on('message', function (data) {
  process.send({
    lines: textUtil.splitLines(markup.highlight(data.text, data.language, data.style)),
    revision: data.revision,
    bucket: data.bucket
  });
});
