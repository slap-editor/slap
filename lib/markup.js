// Deals with blessed-style {bold}tags{/bold}

var logger = require('./logger');
var blessed = require('blessed');

function Markup (style, contents) {
  this.style = style || '';
  this.contents = contents || [];
}

Markup.TAG_RE = /\{(\/?)([\w\-,;!#]*)\}/;
Markup.TAG_RE_G = new RegExp(Markup.TAG_RE.source, 'g');
Markup.parse = function (text) {
  if (text instanceof Markup) return text;
  var markup = new Markup();
  var hierarchy = [markup], match;
  while (match = text.match(Markup.TAG_RE)) {
    var tag = match[0];
    var parent = hierarchy[hierarchy.length - 1];
    if (match.index) parent.push(text.slice(0, match.index));
    if (!match[1]) { // open tag
      var replace = {open: '{', close: '}'}[match[2]];
      if (replace) {
        parent.push(replace);
      } else {
        var newMarkup = new Markup(match[0]);
        parent.push(newMarkup);
        hierarchy.push(newMarkup);
      }
    } else { // close tag
      if (match[0] === '{/}') hierarchy.splice(1, Infinity);
      else if (parent.style === '{'+match[2]+'}') hierarchy.pop();
      else throw new Error("invalid close tag");
    }
    text = text.slice(match.index + tag.length);
  }
  if (hierarchy.length !== 1) throw new Error("mismatched tag");
  if (text) markup.push(text);
  return markup;
};
Markup.closeTags = function (markedUp) {
  return (markedUp
    .replace(Markup.TAG_RE_G, '{/$2}', 'g') // 'g' flag ignored :(
    .match(Markup.TAG_RE_G) || [])
    .reverse()
    .join('');
};
Markup.getTaglessLength = function (val) {
  if (val instanceof Markup) return val.contents.reduce(function (total, item) {
    return total + Markup.getTaglessLength(item);
  }, 0);
  return val.length;
};

Markup.prototype.tag = function (style, start, end) {
  if (typeof start !== 'number') start = 0;
  if (typeof end !== 'number') end = Infinity;

  return this.slice(0, start).concat(new Markup(style, [this.slice(start, end)]), this.slice(end));
};
Markup.prototype.slice = function (start, end) {
  if (typeof start !== 'number') start = 0;
  if (typeof end !== 'number') end = Infinity;

  var i = 0;
  var markup = new Markup(this.style);
  this.contents.some(function (item) {
    var nextI = i + Markup.getTaglessLength(item);
    if (start < nextI && end >= i) {
      markup.push(item.slice(Math.max(0, start - i), Math.max(0, end - i)));
    }
    if (nextI >= end) return true;
    i = nextI;
  });
  return markup;
};
Markup.prototype.concat = function () {
  return new Markup(this.style, this.contents.concat.apply(this.contents, arguments));
};
Markup.prototype.push = function () {
  return this.contents.push.apply(this.contents, arguments);
};
Markup.prototype.toString = function () {
  return this.style + this.contents.map(function (item) {
    return typeof item === 'string' ? blessed.escape(item) : item;
  }).join('') + Markup.closeTags(this.style);
};
Object.defineProperty(Markup.prototype, 'length', {get: function () {
  return this.toString().length;
}});

function markup (text, style, start, end) {
  return Markup.parse(text).tag(style, start, end);
}
markup.parse = Markup.parse;

module.exports = markup;
