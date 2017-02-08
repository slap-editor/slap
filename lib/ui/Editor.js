var _ = require('lazy.js');
var blessed = require('blessed');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var extname = require('path').extname;
var lodash = require('lodash');
require('es6-set/implement'); // required for text-buffer
var TextBuffer = require('text-buffer');
var Point = require('text-buffer/lib/point');
var Range = require('text-buffer/lib/range');

var Slap = require('./Slap');
var BaseElement = require('./BaseElement');

var util = require('../util');
var word = require('../word');
var markup = require('../markup');
var textUtil = require('../textUtil');
var highlightClient = require('../highlight/client');

function Editor (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new Editor(opts);

  BaseElement.call(self, _({
      focusable: true,
      multiLine: true
    })
    .merge(Slap.global.options.editor || {})
    .merge(opts || {})
    .toObject());

  self.gutter = new BaseElement(_(Slap.global.options.editor.gutter)
    .merge({
      parent: self,
      tags: true,
      wrap: false,
      style: {},
      top: 0,
      left: 0,
      bottom: 0
    })
    .merge(self.options.gutter || {})
    .toObject());

  self.buffer = new BaseElement(_(Slap.global.options.editor.buffer)
    .merge({
      parent: self,
      tags: true,
      wrap: false,
      style: {},
      top: 0,
      left: self.options.multiLine && !self.gutter.options.hidden ? self.gutter.width : 0,
      right: 0,
      bottom: 0
    })
    .merge(self.options.buffer || {})
    .toObject());

  self.textBuf = new TextBuffer({encoding: self.options.defaultEncoding});
  self.textBuf.loadSync();

  self.selection = self.textBuf.markPosition(new Point(0, 0), {type: 'selection', invalidate: 'never'});
  self.scroll = new Point(0, 0);
  self.data.updatePreferredX = true;

  self.language(false);
  self._initHighlighting();

  var _updateContent = self._updateContent.bind(self);
  self._updateContent = lodash.throttle(_updateContent, self.options.perf.updateContentThrottle, false);
  self._updateContent();
}
Editor.prototype.__proto__ = BaseElement.prototype;

Editor.prototype.open = Promise.method(function (path) {
  var self = this;
  var pathCoords = self._extractCoordsFromPath(path);
  
  path = util.resolvePath(pathCoords.path);
  
  return self.ready // ensures textBuf path-changed is triggered in _initHandlers

    // a little hacky, but handles errors that text-buffer doesn't
    .then(function () { return fs.openAsync(path, 'r'); })
    .then(function (fd) { return fs.closeAsync(fd); })
    .catch(function (err) {
      if (err.code === 'ENOENT') return true;
      throw err;
    })
    .tap(function () { return self.textBuf.setPath(util.resolvePath(path)); })
    .then(function (dontLoad) { if (!dontLoad) return self.textBuf.load(); })
    .then(function (content) { return self._clipCursorToContent(pathCoords.coords, content); })
    .then(function (cursor) {
      self.selection.setHeadPosition(new Point(pathCoords.coords.y, pathCoords.coords.x));
      self.selection.clearTail();
    })
    .catch(function (err) {
      switch ((err.cause || err).code) {
        case 'EACCES':
          self.slap.header.message(err.message, 'error');
          break;
        default: throw err;
      }
    });
});
Editor.prototype.save = Promise.method(function (path) {
  var self = this;
  var header = self.slap.header;
  return Promise.resolve()
    .then(function () {
      return path ? self.textBuf.saveAs(util.resolvePath(path)) : self.textBuf.save();
    })
    .then(function () {
      header.message("saved to " + self.textBuf.getPath(), 'success');
      return self.textBuf.getPath();
    })
    .catch(function (err) {
      switch ((err.cause || err).code) {
        case 'EACCES': case 'EISDIR':
          header.message(err.message, 'error');
          break;
        default: throw err;
      }
    });
});

Editor.prototype.language = util.getterSetter('language', null, null);
Editor.prototype.readOnly = util.getterSetter('readOnly', null, Boolean);
Editor.prototype.lineWithEndingForRow = function (row) {
  var self = this;
  return self.textBuf.lineForRow(row) + self.textBuf.lineEndingForRow(row);
};
Editor.prototype.delete = function (range) {
  var self = this;
  if (!range) {
    self.textBuf.setTextInRange(self.selection.getRange(), '');
  } else {
    self.textBuf.delete(range);
  }
  return self;
};
Editor.prototype._getTabString = function () {
  var self = this;
  return self.buffer.options.useSpaces
    ? _.repeat(' ', self.buffer.options.tabSize).join('')
    : '\t';
};
Editor.prototype.indent = function (range, dedent) {
  var self = this;

  var tabString = self._getTabString();
  var indentRegex = new RegExp('^(\t| {0,'+self.buffer.options.tabSize+'})', 'g');
  var startDiff = 0, endDiff = 0;
  var linesRange = range.copy();
  linesRange.start.column = 0;
  linesRange.end.column = Infinity;
  self.textBuf.setTextInRange(linesRange, textUtil.splitLines(self.textBuf.getTextInRange(linesRange))
    .map(function (line, i) {
      var result = !dedent
        ? tabString + line
        : line.replace(indentRegex, '');
      if (i === 0)                       startDiff = result.length - line.length;
      if (i === range.getRowCount() - 1) endDiff   = result.length - line.length;
      return result;
    })
    .join(''));
  range = range.copy();
  range.start.column += startDiff;
  range.end.column += endDiff;
  self.selection.setRange(range);
  return self;
};

Editor._tabRegExp = /\t/g;
Editor.prototype.visiblePos = function (pos) {
  var self = this;
  if (pos instanceof Range) return new Range(self.visiblePos(pos.start), self.visiblePos(pos.end));
  pos = Point.fromObject(pos, true);
  pos.column = self.lineWithEndingForRow(pos.row)
    .slice(0, Math.max(pos.column, 0))
    .replace(Editor._tabRegExp, _.repeat('\t', self.buffer.options.tabSize).join(''))
    .length;
  return pos;
};
Editor.prototype.realPos = function (pos) {
  var self = this;
  if (pos instanceof Range) return new Range(self.realPos(pos.start), self.realPos(pos.end));
  pos = self.textBuf.clipPosition(Point.fromObject(pos, true));
  pos.column = this.lineWithEndingForRow(pos.row)
    .replace(Editor._tabRegExp, _.repeat('\t', this.buffer.options.tabSize).join(''))
    .slice(0, Math.max(pos.column, 0))
    .replace(new RegExp('\\t{1,'+this.buffer.options.tabSize+'}', 'g'), '\t')
    .length;
  return pos;
};

Editor.prototype.moveCursorVertical = function (count, paragraphs) {
  var self = this;
  var selection = self.selection;
  var cursor = selection.getHeadPosition().copy();
  if (count < 0 && cursor.row === 0) {
    selection.setHeadPosition(new Point(0, 0));
  } else if (count > 0 && cursor.row === self.textBuf.getLastRow()) {
    selection.setHeadPosition(new Point(Infinity, Infinity));
  } else {
    if (paragraphs) {
      paragraphs = Math.abs(count);
      var direction = count ? paragraphs / count : 0;
      while (paragraphs--) {
        while (true) {
          cursor.row += direction;

          if (!(0 <= cursor.row && cursor.row < self.textBuf.getLastRow())) break;
          if (/^\s*$/g.test(self.textBuf.lineForRow(cursor.row))) break;
        }
      }
    } else {
      cursor.row += count;
    }

    var x = self.data.preferredCursorX;
    if (typeof x !== 'undefined') cursor.column = self.realPos(new Point(cursor.row, x)).column;
    self.data.updatePreferredX = false;
    selection.setHeadPosition(cursor);
    self.data.updatePreferredX = true;
  }

  return self;
};
Editor.prototype.moveCursorHorizontal = function (count, words) {
  var self = this;
  var selection = self.selection;

  if (words) {
    words = Math.abs(count);
    var direction = words / count;
    while (words--) {
      var cursor = selection.getHeadPosition();
      var line = self.textBuf.lineForRow(cursor.row);
      var wordMatch = word[direction === -1 ? 'prev' : 'current'](line, cursor.column);
      self.moveCursorHorizontal(direction * Math.max(1, {
        '-1': cursor.column - (wordMatch ? wordMatch.index : 0),
        '1': (wordMatch ? wordMatch.index + wordMatch[0].length : line.length) - cursor.column
      }[direction]));
    }
  } else {
    var cursor = selection.getHeadPosition().copy();
    while (true) {
      if (-count > cursor.column) {
        // Up a line
        count += cursor.column + 1;
        if (cursor.row > 0) {
          cursor.row -= 1;
          cursor.column = self.textBuf.lineForRow(cursor.row).length;
        }
      } else {
        var restOfLineLength = self.textBuf.lineForRow(cursor.row).length - cursor.column;
        if (count > restOfLineLength) {
          // Down a line
          count -= restOfLineLength + 1;
          if (cursor.row < self.textBuf.getLastRow()) {
            cursor.column = 0;
            cursor.row += 1;
          }
        } else {
          // Same line
          cursor.column += count;
          selection.setHeadPosition(cursor);
          break;
        }
      }
    }
  }

  return self;
};

Editor._bracketsRegExp = /((\()|(\[)|(\{))|((\))|(\])|(\}))/;
Editor.prototype.matchingBracket = function (pos) {
  var self = this;

  pos = pos || self.selection.getHeadPosition();
  var bracket = (self.lineWithEndingForRow(pos.row)[pos.column] || '').match(Editor._bracketsRegExp);
  if (!bracket) return;
  var start = !!bracket[1];
  var _half = (bracket.length - 3)/2 + 1;
  function oppositeBracketMatchIndex (bracketMatch) {
    var matchIndex;
    bracketMatch.some(function (match, i) {
      if ([0, 1, _half + 1].indexOf(i) === -1 && match) {
        matchIndex = i + _half*(start ? 1 : -1);
        return true;
      }
    });
    return matchIndex;
  }

  var lines = textUtil.splitLines(self.textBuf.getTextInRange(start
    ? new Range(pos, new Point(Infinity, Infinity))
    : new Range(new Point(0, 0), new Point(pos.row, pos.column + 1))));

  if (!start) lines.reverse();

  var matches = [];
  var result = false;
  lines.some(function (line, row) {
    var column = start ? -1 : Infinity;
    while (true) {
      column = start
        ? textUtil.regExpIndexOf(line, Editor._bracketsRegExp, column + 1)
        : textUtil.regExpLastIndexOf(line.slice(0, column), Editor._bracketsRegExp);
      if (column === -1) break;
      var match = line[column].match(Editor._bracketsRegExp);
      if (!!match[1] === start) {
        matches.push(match);
      } else {
        var isOppositeBracket = !!match[oppositeBracketMatchIndex(matches.pop())];
        if (!matches.length || !isOppositeBracket) {
          result = {
            column: column + (start && row === 0 && pos.column),
            row: pos.row + (start ? row : -row),
            match: isOppositeBracket
          }
          return true;
        }
      }
    }
  });
  return result;
};

Editor.prototype._requestHighlight = function () {
  var self = this;
  if (self.options.highlight) {
    var highlight = self.data.highlight;
    highlight.revision++;
    highlightClient.call('send', {
      type: 'highlight',
      text: self.textBuf.getText(),
      language: self.language(),
      revision: highlight.revision,
      bucket: highlight.bucket
    }).done();
  }
};

Editor.prototype._initHighlighting = function () {
  var self = this;

  self.data.highlight = {ranges: [], revision: 0, bucket: highlightClient.getBucket()};

  highlightClient.done(function (client) {
    self.on('language', function () { self._requestHighlight(); });
    self.textBuf.on('changed', function () { self._requestHighlight(); });
    client.once('message', function highlight (data) {
      if (self.isAttached()) client.once('message', highlight);
      if (data.bucket === self.data.highlight.bucket && data.revision >= self.data.highlight.revision) {
        self.destroyMarkers({type: 'syntax'});
        self.data.highlight = data;
        self.data.highlight.ranges.forEach(function (range) {
          self.textBuf.markRange(range.range, range.properties);
        });
        self._updateContent();
      }
    });
  });

  return self;
};
Editor.prototype.clipScroll = function (poss) {
  var self = this;

  var size = self.buffer.size();
  var scroll = (poss || []).reduce(function (scroll, pos) {
    var cursorPadding = self.buffer.options.cursorPadding || {};
    var minScroll = pos.translate(size.negate())
      .translate(new Point((cursorPadding.right || 0) + 1, (cursorPadding.bottom || 0) + 1));
    var maxScroll = pos
      .translate(new Point(-cursorPadding.left || 0, -cursorPadding.top || 0));

    return new Point(
      Math.min(Math.max(scroll.row,    minScroll.row),    maxScroll.row),
      Math.min(Math.max(scroll.column, minScroll.column), maxScroll.column));
  }, self.scroll);

  self.scroll = new Point(
    Math.max(0, Math.min(scroll.row, self.textBuf.getLineCount() - size.row)),
    Math.max(0, scroll.column));
  self._updateContent();

  return self;
};
Editor.prototype._markMatches = function () {
  var self = this;
  var selection = self.selection.getRange();
  var selectionText = self.textBuf.getTextInRange(selection);
  var line = self.lineWithEndingForRow(selection.end.row);

  self.destroyMarkers({type: 'match'});
  if (selection.isSingleLine() && selectionText.match(/^[\w.-]+$/)
   && (line[selection.start.column - 1] || ' ').match(/\W/)
   && (line[selection.end.column] || ' ').match(/\W/)) {
    self.textBuf.scan(new RegExp('\\b'+textUtil.escapeRegExp(selectionText)+'\\b', 'g'), function (match) {
      self.textBuf.markRange(match.range, {type: 'match'});
    });
  };
  return self;
};
Editor.prototype._initHandlers = function () {
  var self = this;

  var selection = self.selection;

  self.on('keypress', function (ch, key) {
    var selectionRange = selection.getRange().copy();
    var binding = util.getBinding(self.options.bindings, key);
    if (self.options.multiLine
      && binding === 'indent'
      && key.full === 'tab'
      && selectionRange.isSingleLine()) binding = false;

    if (binding && ['go', 'select', 'delete'].some(function (action) {
      if (binding.indexOf(action) === 0) {
        if (action !== 'go') selection.plantTail();
        var directionDistance = binding.slice(action.length);
        return [
          {name: 'All'},
          {name: 'MatchingBracket'},
          {name: 'Left', axis: 'horizontal', direction: -1},
          {name: 'Right', axis: 'horizontal', direction: 1},
          {name: 'Up', axis: 'vertical', direction: -1},
          {name: 'Down', axis: 'vertical', direction: 1}
        ].some(function (direction) {
          if (directionDistance.indexOf(direction.name) === 0) {
            var moved = true;
            var startSelectionHead = selection.getHeadPosition();

            if (direction.name === 'All') {
              selection.setRange(self.textBuf.getRange());
            } else if (direction.name === 'MatchingBracket') {
              var matchingBracket = self.matchingBracket();
              if (matchingBracket) selection.setHeadPosition(matchingBracket);
              else moved = false;
            } else { // } else if ('direction' in direction) {
              var selectionDirection = -(!selection.getRange().isEmpty() && selection.isReversed() * 2 - 1);
              if (!(action === 'delete' && (selectionDirection || self.readOnly()))) {
                var distance = directionDistance.slice(direction.name.length);
                switch (direction.axis) {
                  case 'horizontal':
                    switch (distance) {
                      case '':
                        if (action === 'go' && direction.direction === -selectionDirection) {
                          selection.setHeadPosition(selection.getTailPosition());
                        } else {
                          self.moveCursorHorizontal(direction.direction);
                        }
                        break;
                      case 'Word': self.moveCursorHorizontal(direction.direction, true); break;
                      case 'Infinity':
                        var cursor = selection.getHeadPosition();
                        var firstNonWhiteSpaceX = (self.lineWithEndingForRow(cursor.row).match(/^\s*/) || [''])[0].length;
                        selection.setHeadPosition(new Point(cursor.row, direction.direction === -1
                          ? cursor.column === firstNonWhiteSpaceX
                            ? 0
                            : firstNonWhiteSpaceX
                          : Infinity));
                        break;
                      default: moved = false; break;
                    }
                    break;
                  case 'vertical':
                    switch (distance) {
                      case '': self.moveCursorVertical(direction.direction); break;
                      case 'Paragraph': self.moveCursorVertical(direction.direction, true); break;
                      case 'Page': self.moveCursorVertical(direction.direction * self.options.pageLines); break;
                      case 'Infinity':
                        selection.setHeadPosition(direction.direction === -1
                          ? new Point(0, 0)
                          : new Point(Infinity, Infinity));
                        break;
                      default: moved = false; break;
                    }
                }
              }
            }
            if (moved) {
              if (action === 'go') selection.clearTail();
              if (action === 'delete' && !self.readOnly()) self.delete();
              return true;
            }
          }
        });
      }
    })) {
      return false;
    } else {
      switch (binding) {
        case 'selectLine':
        case 'deleteLine':
          var cursor = selection.getHeadPosition();
          selection.setRange(new Range(
            cursor.row === self.textBuf.getLineCount() - 1
              ? new Point(cursor.row - 1, Infinity)
              : new Point(cursor.row, 0),
            new Point(cursor.row + 1, 0)));
          if (binding === 'deleteLine') self.delete();
          selection.setHeadPosition(cursor);
          return false;
        case 'indent':
        case 'dedent':
          if (!self.options.multiLine) return;
          self.indent(selectionRange, binding === 'dedent'); return false;
        case 'duplicateLine':
          var cursor = selection.getHeadPosition();
          var line = self.lineWithEndingForRow(cursor.row);
          if (line === self.textBuf.lineForRow(cursor.row)) line = '\n' + line;
          var nextLinePos = new Point(cursor.row + 1, 0);
          self.textBuf.setTextInRange(new Range(nextLinePos, nextLinePos), line);
          return false;
        case 'undo': self.textBuf.undo(); return false;
        case 'redo': self.textBuf.redo(); return false;
        default:
          if (!binding && !key.ctrl && ch) {
            var enterPressed = key.name === 'return' || key.name === 'linefeed';
            var cursor = selection.getHeadPosition();
            var line = self.lineWithEndingForRow(cursor.row);
            if (enterPressed) {
              if (!self.options.multiLine) return;
              ch = '\n' + line.slice(0, cursor.column).match(/^( |\t)*/)[0];
            } else if (key.name === 'enter') {
              return; // blessed remaps keys -- ch and key.sequence here are '\r'
            } else if (ch === '\t') {
              ch = self._getTabString();
            } else if (ch === '\x1b') { // escape
              return;
            }

            if (!self.readOnly()) {
              if (selectionRange.isEmpty() && !self.slap.insertMode() && !enterPressed) selectionRange.end.column++;
              selection.setRange(self.textBuf.setTextInRange(selectionRange, ch));
              selection.reversed = false;
              selection.clearTail();
            }
            return false;
          }
          break;
      }
    }
  });

  self.on('mouse', function (mouseData) {
    process.nextTick(function () { self._lastMouseData = mouseData; });
    if (mouseData.action === 'wheeldown' || mouseData.action === 'wheelup') {
      self.scroll.row += {
        wheelup: -1,
        wheeldown: 1
      }[mouseData.action] * self.options.pageLines;
      self.clipScroll();
      return;
    }

    var mouse = self.realPos(new Point(mouseData.y, mouseData.x)
      .translate(self.buffer.pos().negate())
      .translate(self.scroll));

    var newSelection = selection.copy();
    if (mouseData.action === 'mouseup') self.data.lastClick = {mouse: mouse, time: Date.now()};
    if (mouseData.action === 'mousedown') {
      var lastClick = self.data.lastClick;
      if (lastClick && mouse.isEqual(lastClick.mouse) && lastClick.time + self.options.doubleClickDuration > Date.now()) {
        self.data.lastClick = null;
        var line = self.textBuf.lineForRow(mouse.row);
        var startX = mouse.column;
        var endX = mouse.column + 1;
        var prev = word.prev(line, mouse.column);
        var current = word.current(line, mouse.column);
        if (current) {
          if (prev && current.index < prev.index + prev[0].length) {
            startX = prev.index;
            endX = prev.index + prev[0].length;
          } else if (current.index <= mouse.column && mouse.column < current.index + current[0].length) {
            startX = current.index;
            endX = current.index + current[0].length;
          }
        }
        newSelection.setRange(new Range(new Point(mouse.row, startX), new Point(mouse.row, endX)));
      } else {
        if ((self._lastMouseData || {}).action !== 'mousedown' && !mouseData.shift) newSelection.clearTail();
        newSelection.setHeadPosition(mouse);
        newSelection.plantTail();
      }
    }
    selection.setRange(newSelection.getRange(), {reversed: newSelection.isReversed()});
    newSelection.destroy();
  });

  self.textBuf.on('path-changed', function () { self.language(extname(self.textBuf.getPath()).slice(1)); });

  selection.emitter.on('did-change', function () {
    var cursor = self.visiblePos(selection.getHeadPosition());
    if (self.data.updatePreferredX) self.data.preferredCursorX = cursor.column; // preferred X when moving vertically
    self._markMatches();
    self.clipScroll([cursor]);
  });

  ['path-changed', 'changed'].forEach(function (evt) {
    self.textBuf.on(evt, function () { self.slap.header.render(); });
  });
  self.textBuf.on('changed', function () { self._updateContent(); });

  return BaseElement.prototype._initHandlers.apply(self, arguments);
};
Editor.prototype._updateCursor = function () {
  var self = this;
  if (!self.visible) {
    self.screen.program.hideCursor();
    return;
  }
  var scrollCursor = self.visiblePos(self.selection.getHeadPosition()).translate(self.scroll.negate());
  if (new Range(new Point(0, 0), self.buffer.size().translate(new Point(-1, -1))).containsPoint(scrollCursor) && self === self.screen.focused) {
    var screenCursor = scrollCursor.translate(self.buffer.pos());
    self.screen.program.move(screenCursor.column, screenCursor.row);
    self.screen.program.showCursor();
  } else {
    self.screen.program.hideCursor();
  }
};
Editor.prototype._clipCursorToContent = function (cursor) {
  var self = this;
  var linesCount = self.textBuf.getLastRow();
  var lineLength = self.textBuf.lineLengthForRow(cursor.y);
  
  cursor.y = Math.max(Math.min(cursor.y - 1, linesCount), 0);
  cursor.x = Math.max(Math.min(cursor.x - 1, lineLength), 0);
  
  return cursor;
};
Editor.prototype.destroyMarkers = function (params) {
  var self = this;
  self.textBuf.findMarkers(params).forEach(function (marker) {
    marker.destroy();
  });
  return self;
};
Editor.prototype._renderableTabString = function (match) {
  return !this.buffer.options.visibleWhiteSpace
    ? _.repeat(' ', this.buffer.options.tabSize * match.length).join('')
    : markup(_.repeat(
        _.repeat('\u2500', this.buffer.options.tabSize - 1).join('') +
        (this.buffer.options.tabSize ? '\u2574' : '')
      , match.length).join(''), this.options.style.whiteSpace)
};
Editor.prototype._renderableSpace = function (match) {
  return !this.buffer.options.visibleWhiteSpace
    ? match
    : markup(_.repeat('\u00b7', match.length).join(''), this.options.style.whiteSpace);
};
Editor.prototype._renderableLineEnding = function (lineEnding) {
  return !this.buffer.options.visibleLineEndings
    ? ''
    : markup(lineEnding
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
     , this.options.style.whiteSpace);
};
Editor._nonprintableRegExp = /[\x00-\x1f]|\x7f/g;

Editor.MARKER_ORDER = ['syntax', 'match', 'findMatch', 'selection'];
Editor.markerCmp = function (a, b) {
  return Editor.MARKER_ORDER.indexOf(b.properties.type) - Editor.MARKER_ORDER.indexOf(a.properties.type);
};
Editor.prototype._updateContent = function () {
  var self = this;

  var size = self.buffer.size();
  var scroll = self.scroll;
  var selectionRange = self.selection.getRange();
  var matchingBracket = self.matchingBracket(self.selection.getHeadPosition());
  var cursorOnBracket = selectionRange.isEmpty() && matchingBracket !== undefined;
  var visibleSelection = self.visiblePos(selectionRange);
  var visibleCursor = visibleSelection[selectionRange.reversed ? 'start' : 'end'];
  var visibleMatchingBracket = selectionRange.isEmpty() && matchingBracket && self.visiblePos(matchingBracket);

  var style = self.options.style;
  var defaultStyle = style.default;
  var selectionStyle = style.selection;
  var matchStyle = style.match;
  var bracketStyle = matchingBracket && matchingBracket.match ? style.matchingBracket : style.mismatchedBracket;

  var gutterWidth = self.gutter.width;
  var lineNumberWidth = self.gutter.options.lineNumberWidth || 0;
  var currentLineStyle = self.gutter.options.style.currentLine;

  var bufferContent = [];
  var gutterContent = [];

  textUtil.splitLines(blessed.escape(self.textBuf.getTextInRange({
    start: new Point(scroll.row, 0),
    end: scroll.translate(size)
  }))).forEach(function (line, row) {
    var column = scroll.column;
    row += scroll.row;

    var renderableLineEnding = self._renderableLineEnding((line.match(textUtil._lineRegExp) || [''])[0]);
    line = line
      .replace(/\t+/g, self._renderableTabString.bind(self))
      .replace(/ +/g, self._renderableSpace.bind(self))
      .replace(textUtil._lineRegExp, renderableLineEnding)
      .replace(Editor._nonprintableRegExp, '\ufffd');

    line = markup.parse(line)
      .slice(column, column + size.column)
      .push(_.repeat(' ', size.column).join(''))
      .tag(defaultStyle);

    self.textBuf.findMarkers({intersectsRow: row}).sort(Editor.markerCmp).forEach(function (marker) {
      var range = self.visiblePos(marker.getRange());
      if (range.intersectsRow(row)) {
        var markerStyle;
        switch (marker.properties.type) {
          case 'selection': markerStyle = selectionStyle; break;
          case 'match': case 'findMatch': markerStyle = matchStyle; break;
          case 'syntax': markerStyle = marker.properties.syntax
            .map(function (syntax) {
              if (!(syntax in style)) logger.debug("unstyled syntax:", syntax);
              return style[syntax] || '';
            })
            .join(''); break;
          default: throw new Error("unknown marker: " + marker.properties.type);
        }
        line = markup(line, markerStyle,
          row === range.start.row ? range.start.column - column : 0,
          row === range.end.row   ? range.end.column   - column : Infinity);
      }
    });

    if (cursorOnBracket && row === visibleCursor.row) {
      line = markup(line, bracketStyle,
        visibleCursor.column - column,
        visibleCursor.column - column + 1);
    }
    if (visibleMatchingBracket && row === visibleMatchingBracket.row) {
      line = markup(line, bracketStyle,
        visibleMatchingBracket.column - column,
        visibleMatchingBracket.column - column + 1);
    }

    bufferContent.push(line + '{/}');

    var gutterLine = (_.repeat(' ', lineNumberWidth).join('') + (row + 1)).slice(-lineNumberWidth);
    gutterLine += _.repeat(' ', gutterWidth).join('');

    if (currentLineStyle && row === visibleCursor.row) {
      gutterLine = markup(gutterLine, currentLineStyle);
    }

    gutterContent.push(gutterLine + '{/}');
  });

  self.buffer.setContent(bufferContent.join('\n'));
  self.gutter.setContent(gutterContent.join('\n'));
  self.screen.render();
};

Editor.pathCoordsRegExp = /^(.*?)(\:(\d+))?(\:(\d+))?$/;
Editor.prototype._extractCoordsFromPath = function (givenPath) {
  var result = {
    path: givenPath,
    coords: {
      x: 1,
      y: 1
    }
  };
  var match = givenPath.match(Editor.pathCoordsRegExp);
  
  if (match) {
    result.path = match[1];

    if (match[3]) {
      result.coords.y = parseInt(match[3], 10); 
    }
    if (match[5]) {
      result.coords.x = parseInt(match[5], 10); 
    }
  }

  return result;
};

module.exports = Editor;
