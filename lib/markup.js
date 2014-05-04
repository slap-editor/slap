var _ = require('lazy.js');
var hljs = require('highlight.js'); hljs.configure({classPrefix: ''});
var cheerio = require('cheerio');
var Lexer = require('lex');

var util = require('./util');

exports.markupRegExp = /{(\/?)([\w\-,;!#]*)}/g;
exports.addTag = function (tags, tag, close, name) {
  if (!close) tags.push(tag);
  else if (!name) tags.splice(0, Infinity);
  else {
    var lastTagIndex = tags.lastIndexOf('{'+name+'}');
    if (lastTagIndex !== -1) tags.splice(lastTagIndex, 1);
  }
};
exports.markupIndex = function (markup, index) {
  if (index <= 0) return 0;

  var textLength = 0;
  var i = 0;
  var done = false;
  var appendTags = [];
  function retVal () { return i - (textLength - index) - appendTags.join('').length; }
  function addText (text, real) {
    if (done) return retVal();
    i += (real || text).length;
    textLength += text.length;
    if (textLength == index) done = true;
    if (textLength > index) return retVal();
  }
  return new Lexer(addText)
    .addRule(/\{open\}/, addText.bind(null, '{'))
    .addRule(/\{close\}/, addText.bind(null, '}'))
    .addRule(exports.markupRegExp, function (tag, close, name) {
      i += tag.length;
      if (done) {
        exports.addTag.apply(null, [appendTags].concat(util.toArray(arguments)));
      }
    })
    .setInput(markup)
    .lex() || markup.length;
};
exports.closeTags = function (markup) {
  return markup.replace(exports.markupRegExp, '{/$2}', 'g'); // 'g' flag ignored :(
};
exports.escapeCurlies = function (text) {
  return text.replace(/[{}]/g, function (match) {
    return {'{': '{open}', '}': '{close}'}[match];
  });
};
exports.getOpenTags = function (text) {
  var openTags = [];
  new Lexer(function () {})
    .addRule(/\{(open|close)\}/, function () {})
    .addRule(exports.markupRegExp, exports.addTag.bind(null, openTags))
    .setInput(text)
    .lex();
  return openTags;
};
exports.removeMarkup = function (text) {
  var result = [];
  function push (text) { result.push(text); }
  new Lexer(push.bind(null))
    .addRule(/\{open\}/, push.bind(null, '{'))
    .addRule(/\{close\}/, push.bind(null, '}'))
    .addRule(exports.markupRegExp, _.noop)
    .setInput(text)
    .lex();
  return result.join('');
};
exports.markupLine = function (line, markup, startX, endX) {
  markup = markup || '';
  startX = typeof startX !== 'undefined' ? exports.markupIndex(line, startX) : 0;
  endX = typeof endX !== 'undefined' ? exports.markupIndex(line, endX) : Infinity;
  return line.slice(0, startX) +
    markup + line.slice(startX, endX) + exports.closeTags(markup) +
    line.slice(endX);
};

exports.highlight = function (text, language, style) {
  if (language === false) return exports.escapeCurlies(text);

  var highlighted;
  if (language) {
    try { highlighted = hljs.highlight(language, text, true); } catch (e) {}
  }
  if (!highlighted) highlighted = hljs.highlightAuto(text);

  var $ = cheerio.load(exports.escapeCurlies(highlighted.value)); // Assumes hljs output doesn't use curlies

  do {
    var lastElCount = elCount;
    var elCount = $('*:not(:has(*))').replaceWith(function () {
      var $el = $(this);
      var tags = ($el.attr('class') || '')
        .split(' ')
        .map(function (className) { return style[className] || ''; })
        .join('');
      return exports.markupLine($el.text(), tags);
    }).length;
  } while (lastElCount !== elCount);

  return $.root().text();
};
