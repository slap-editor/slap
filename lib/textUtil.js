var Coordinate = require('./coordinate');
var util = require('./util');

exports._lineRegExp = /\r\n|\r|\n/;
exports.stripLine = function (line) {
  return line.replace(exports._lineRegExp, '');
};
exports.splitLines = function (text) {
  var lines = [];
  var match, line;
  while (match = exports._lineRegExp.exec(text)) {
    line = text.slice(0, match.index) + match[0];
    text = text.slice(line.length);
    lines.push(line);
  }
  lines.push(text);
  return lines;
};
exports._getLineSafe = function (lines, n) {
  return lines[Math.max(Math.min(n, lines.length - 1), 0)];
};
exports._getLines = function (text) {
  return typeof text === 'string' ? exports.splitLines(text) : text;
};
exports._getString = function (lines) {
  return typeof lines === 'string' ? lines : lines.join('');
};
exports.spliceLines = function (one, start, end, other) {
  other.unshift(exports._getLineSafe(one, start.y).slice(0, start.x) + (other.shift() || ''));
  other.push(other.pop() + exports._getLineSafe(one, end.y).slice(end.x));

  var before = [].splice.apply(one, [start.y, end.y - start.y + 1].concat(other));
  before.push((before.pop() || '').slice(0, end.x));
  before.unshift(before.shift().slice(start.x));
  return before;
};
exports.range = function (text, start, end) {
  start = start || Coordinate.origin();
  end = end || Coordinate.infinity();
  var result = exports._getLines(text)
    .slice(start.y, end.y + 1)
    .map(function (line, i) {
      if (i + start.y === end.y) line = line.slice(0, end.x);
      if (i === 0) line = line.slice(start.x);
      return line;
    });
  if (typeof text === 'string') result = result.join('');
  return result;
};
exports.find = function (text, pattern, start, end) {
  var range = exports.range.apply(null, [
    text
  ].concat(util.toArray(arguments).slice(2)));

  var match = exports._getString(range).match(pattern);
  if (!match) return;

  var result = start || Coordinate.origin();
  
  exports._getLines(range).some(function (line, y) {
    if (0 <= match.index && match.index < line.length) {
      result.x = match.index + (!y && result.x);
      result.y += y;
      return true;
    }
    match.index -= line.length;
  });
  return result;
};


exports.escapeRegExp = function (text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};
exports.regExpIndexOf = function(str, regex, index) {
  index = index || 0;
  var offset = str.slice(index).search(regex);
  return (offset >= 0) ? (index + offset) : offset;
};
exports.regExpLastIndexOf = function (str, regex, index) {
  if (index === 0 || index) str = str.slice(0, Math.max(0, index));
  var i;
  var offset = -1;
  while ((i = str.search(regex)) !== -1) {
    offset += i + 1;
    str = str.slice(i + 1);
  }
  return offset;
};
