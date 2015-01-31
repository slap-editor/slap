#!/usr/bin/env node

var hljs = require('highlight.js'); hljs.configure({classPrefix: ''});
var cheerio = require('cheerio');

var logger = require('../logger');
var textUtil = require('../textUtil');

function highlight (text, language) {
  if (language === false) return [];

  var highlighted;
  if (language) {
    try { highlighted = hljs.highlight(language, text, true); } catch (e) {}
  }
  if (!highlighted) highlighted = hljs.highlightAuto(text);

  var $ = cheerio.load(highlighted.value);
  var ranges = [];
  do {
    var lastElCount = elCount;
    var elCount = $('*:not(:has(*))').replaceWith(function () {
      var $el = $(this);
      var text = '';
      [this].concat($el.parents().get(), [$.root()]).reverse().reduce(function (parent, el) {
        $(parent).contents().each(function () {
          var $sibling = $(this);
          if ($sibling.is(el)) return false;
          text += $sibling.text();
        });
        return el;
      });
      var lines = textUtil.splitLines(text);
      var linesPlusEl = textUtil.splitLines(text + $el.text());
      ranges.push({
        range: [
          [lines      .length - 1, lines[lines.length - 1]            .length],
          [linesPlusEl.length - 1, linesPlusEl[linesPlusEl.length - 1].length]
        ],
        properties: {
          type: 'syntax',
          syntax: ($el.attr('class') || '').match(/\S+/g) || []
        }
      });
      return $el.text();
    }).length;
  } while (lastElCount !== elCount);

  return ranges;
};

process.on('message', function (message) {
  switch (message.type) {
    case 'highlight':
      process.send({
        ranges: highlight(message.text, message.language),
        revision: message.revision,
        bucket: message.bucket
      });
      break;
    case 'logger': logger(message.options); break;
  }
});
