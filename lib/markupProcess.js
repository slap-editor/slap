#!/usr/bin/env node

var es = require('event-stream');

var markup = require('./markup');

process.stdin
  .pipe(es.split())
  .pipe(es.parse())
  .pipe(es.mapSync(function (data) {
    return markup(data.text, data.language, data.style);
  }))
  .pipe(es.stringify())
  .pipe(process.stdout);
