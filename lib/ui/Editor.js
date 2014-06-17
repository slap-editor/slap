var _ = require('lazy.js');
var blessed = require('blessed');
var clipboard = require('copy-paste').noConflict();
var Undo = require('undo.js');

var Coordinate = require('../Coordinate');
var util = require('../util');
var word = require('../word');
var markup = require('../markup');
var textUtil = require('../textUtil');
var highlightClient = require('../highlight/client');
var logger = require('../logger');

function Editor (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new Editor(opts);

  blessed.Box.call(self, _({
    multiLine: true
  }).merge(opts || {}).toObject());
  ['parent', 'left', 'right', 'top', 'bottom'].forEach(function (key) {
    delete opts[key];
  });

  self.gutter = new blessed.Box(_({
    parent: self,
    tags: true,
    wrap: false,
    style: {},
    top: 0,
    left: 0,
    width: 0,
    bottom: 0
  }).merge(opts.gutter || {}).toObject());

  self.buffer = new blessed.Box(_({
    parent: self,
    tags: true,
    wrap: false,
    tabSize: 4,
    style: {},
    top: 0,
    left: self.options.multiLine && self.gutter.visible ? self.gutter.width : 0,
    right: 0,
    bottom: 0
  }).merge(opts || {}).merge(opts.buffer || {}).toObject());

  self
    .text('', false)
    .cursor(Coordinate.origin())
    .scroll(Coordinate.origin())
    ._initChangeStack()
    ._initHighlighting()
    ._initHandlers();
}
Editor.prototype.__proto__ = blessed.Box.prototype;

Editor.prototype.language = util.getterSetter('language', null, null);
Editor.prototype.readOnly = util.getterSetter('readOnly', null, Boolean);
Editor.prototype.line = function (n, stripLineEnding) {
  var line = textUtil._getLineSafe(this.data.lines, arguments.length
    ? n
    : this.cursor().y);
  if (stripLineEnding) line = textUtil.stripLine(line);
  return line;
};
Editor.prototype.lines = function () { return util.toArray(this.data.lines); };
Editor.prototype.text = function (text, language) {
  var self = this;

  if (arguments.length) {
    return self
      .language(language)
      .change(text.toString(),
        Coordinate.origin(),
        Coordinate.infinity());
  } else {
    return self.data.lines.join('');
  }
};
Editor.prototype.change = function (text, start, end) {
  var self = this;

  if (!self.options.multiLine) text = textUtil.stripLine(text);
  if (arguments.length < 3) {
    if (arguments.length === 1) start = self.select();
    end = start.end; start = start.start;
  }
  var load = start.load;
  if (load || !self.readOnly()) {
    var lines = self.data.lines;
    if (load) self.data.lines = lines = [''];
    var oldText = textUtil.spliceLines(lines, start, end, textUtil._getLines(text)).join('');

    self.select(null, start);
    if (!load) self.moveCursorHorizontal(text.length);

    self.emit('change', text, start, end, load, oldText);
    self.emit('lines', util.toArray(lines), load, oldText);
    self.emit('text', self.text(), load, oldText);
  }
  return this;
};
Editor.prototype.delete = function () {
  return this.change.apply(this, [''].concat(util.toArray(arguments)));
};
Editor.prototype._getTabString = function () {
  return this.options.useSpaces
    ? _.repeat(' ', this.options.tabSize).join('')
    : '\t';
};
Editor.prototype.indent = function (start, end, dedent) {
  var self = this;

  var cursor = self.cursor();
  var startSelection = self.startSelection();

  return self
    .change(self.data.lines
      .slice(start.y, end.y + 1)
      .map(function (line, i) {
        var newLine = !dedent
          ? self._getTabString() + line
          : line.replace(new RegExp('^\t| {,'+self.options.tabSize+'}', 'g'), '');

        var lengthDifference = newLine.length - line.length;
        if (i + start.y === cursor.y)
          cursor.x += lengthDifference;
        if (startSelection && i + start.y === startSelection.y)
          startSelection.x += lengthDifference;

        return newLine;
      })
      .join('')
    , {x: 0, y: start.y}, {x: 0, y: end.y + 1})
  .select(startSelection, cursor);
};

Editor._tabRegExp = /\t/g;
Editor.prototype.visiblePos = function (pos) {
  var self = this;
  if ('start' in pos && 'end' in pos) {
    return {start: self.visiblePos(pos.start), end: self.visiblePos(pos.end)};
  }
  return {
    x: self.line(pos.y)
      .slice(0, Math.max(pos.x, 0))
      .replace(Editor._tabRegExp, _.repeat('\t', self.options.tabSize).join(''))
      .length,
    y: pos.y
  };
};
Editor.prototype.realPos = function (pos) {
  return {
    x: this.line(pos.y)
      .replace(Editor._tabRegExp, _.repeat('\t', this.options.tabSize).join(''))
      .slice(0, Math.max(pos.x, 0))
      .replace(new RegExp('\\t{1,'+this.options.tabSize+'}', 'g'), '\t')
      .length,
    y: pos.y
  };
};

Editor.prototype.scroll = util.getterSetter('scroll', util.clone, Coordinate.setter(function (c) {
  var result = Coordinate({
    x: Infinity,
    y: this.data.lines.length
  }).subtract(this.bufferSize());
  return result;
}));

var cursorSetter = Coordinate.setter(function (c) {
  var line = this.line(c.y, true);
  return {
    x: (line || '').length,
    y: this.data.lines.length - 1
  };
});

Editor.prototype.cursor = util.getterSetter('cursor', util.clone, function (c, updatePreferredX) {
  var cursor = cursorSetter.apply(this, arguments);
  if (typeof updatePreferredX === 'undefined' || updatePreferredX) {
    this.data.preferredCursorX = this.visiblePos(cursor).x;
  }
  return cursor;
});
Editor.prototype.moveCursorVertical = function (count, paragraphs) {
  var self = this;

  var cursor = self.cursor();

  if (paragraphs) {
    paragraphs = Math.abs(count);
    var direction = paragraphs / count;
    while (paragraphs--) {
      while (true) {
        cursor.y += direction;

        if (!(0 <= cursor.y && cursor.y < self.data.lines.length - 1)) break;
        if (/^\s*$/g.test(self.line(cursor.y, true))) break;
      }
    }
  } else {
    cursor.y += count;
  }

  self.cursor({
    x: Math.max(0, cursor.y < self.data.lines.length
      ? self.realPos({x: self.data.preferredCursorX, y: cursor.y}).x
      : self.line(cursor.y, true).length
    ),
    y: cursor.y
  }, false);

  return self;
};
Editor.prototype.moveCursorHorizontal = function (count, words) {
  var self = this;

  var cursor = self.cursor();

  if (words) {
    words = Math.abs(count);
    var direction = words / count;
    while (words--) {
      var line = self.line(cursor.y, true);
      var wordMatch = word[direction === -1 ? 'prev' : 'current'](line, cursor.x);
      cursor = self.moveCursorHorizontal(direction * Math.max(1, {
        '-1': cursor.x - (wordMatch ? wordMatch.index : 0),
        '1': (wordMatch ? wordMatch.index + wordMatch[0].length : line.length) - cursor.x
      }[direction])).cursor();
    }
  } else {
    while (true) {
      if (-count > cursor.x) {
        // Up a line
        count += cursor.x + 1;
        if (cursor.y > 0) {
          cursor.y -= 1;
          cursor.x = self.line(cursor.y, true).length;
        }
      } else {
        var restOfLineLength = self.line(cursor.y, true).length - cursor.x;
        if (count > restOfLineLength) {
          // Down a line
          count -= restOfLineLength + 1;
          if (cursor.y < self.data.lines.length - 1) {
            cursor.x = 0;
            cursor.y += 1;
          }
        } else {
          // Same line
          cursor.x += count;
          self.cursor(cursor);
          break;
        }
      }
    }
  }

  return self;
};

Editor.prototype.startSelection = util.getterSetter('startSelection', function (c) {
  return c ? util.clone(c) : null;
}, function (c) {
  if (c === null) return null;
  return cursorSetter.apply(this, arguments);
});

Editor.prototype.select = function (start, end) {
  var self = this;

  if (arguments.length) {
    if (arguments.length === 1) {
      if ('end' in start && 'start' in start) {
        end = start.end; start = start.start;
      } else {
        end = start; start = self.cursor();
      }
    }
    return self
      .startSelection(start)
      .cursor(end);
  } else {
    var cursor = self.cursor();
    var selectionBounds = [self.startSelection() || cursor, cursor];
    selectionBounds.sort(Coordinate.linear.cmp);
    return {
      start: selectionBounds[0],
      end: selectionBounds[1],
      text: textUtil.range(self.data.lines,
        selectionBounds[0],
        selectionBounds[1]).join('')
    };
  }
};

Editor.prototype.copy = function () {
  var self = this;
  var text = self.select().text;
  if (text) clipboard.copy(self.data.clipboard = text);
};
Editor.prototype.paste = function () {
  var self = this;
  clipboard.paste(function (err, text) {
    if (err) text = self.data.clipboard;
    self.change(text || '');
  });
};

Editor._bracketsRegExp = /((\()|(\[)|(\{))|((\))|(\])|(\}))/;
Editor.prototype.matchingBracket = function (pos) {
  var self = this;

  pos = pos || self.cursor();
  var bracket = (self.line(pos.y)[pos.x] || '').match(Editor._bracketsRegExp);
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

  var lines = start
    ? textUtil.range(self.data.lines, pos)
    : textUtil.range(self.data.lines, Coordinate.origin(), {x: pos.x + 1, y: pos.y});

  if (!start) lines.reverse();

  var matches = [];
  var result = false;
  lines.some(function (line, y) {
    var x = start ? -1 : Infinity;
    while (true) {
      x = start
        ? textUtil.regExpIndexOf(line, Editor._bracketsRegExp, x + 1)
        : textUtil.regExpLastIndexOf(line.slice(0, x), Editor._bracketsRegExp);
      if (x === -1) break;
      var match = line[x].match(Editor._bracketsRegExp);
      if (!!match[1] === start) {
        matches.push(match);
      } else {
        var isOppositeBracket = !!match[oppositeBracketMatchIndex(matches.pop())];
        if (!matches.length || !isOppositeBracket) {
          result = {
            x: x + (start && y === 0 && pos.x),
            y: pos.y + (start ? y : -y),
            match: isOppositeBracket
          }
          return true;
        }
      }
    }
  });
  return result;
};
Editor.prototype.find = function () {
  return textUtil.find.apply(null, [
    this.lines()
  ].concat(util.toArray(arguments)));
};
Editor.prototype.findAll = function (pattern, start, end) {
  var self = this;
  var start = start || Coordinate.origin();
  return _
    .generate(function () {
      var match = self.find(pattern, start, end);
      if (!match) return;
      start = _(match.start).toObject(); start.x++;
      return match;
    })
    .takeWhile(Boolean)
    .toArray();
};

Editor.prototype.bufferPos = function () {
  return Coordinate({
    x: this.buffer.left + this.buffer.ileft,
    y: this.buffer.top + this.buffer.itop
  });
};

Editor.prototype.bufferSize = function () {
  return Coordinate({
    x: this.buffer.width - this.buffer.iwidth,
    y: this.buffer.height - this.buffer.iheight
  });
};

Editor.ChangeCommand = Undo.Command.extend({
  constructor: function (editor, state) {
    this.editor = editor;
    this.state = state;
  },
  execute: function () {},
  undo: function () {
    this
      .change(this.state.newText, this.state.oldText)
      .select(this.state)
      .scroll(this.state.scroll);
  },
  redo: function () {
    this
      .change(this.state.oldText, this.state.newText)
      .select(this.state.startSelection, this.state.cursor)
      .scroll(this.state.scroll);
  },
  change: function (oldText, newText) {
    this.editor.applyingChangeState = true;
    var oldLines = textUtil.splitLines(oldText);
    var editor = this.editor.change(newText, this.state.start, {
      x: textUtil._getLineSafe(oldLines, Infinity).length + (oldLines.length === 1
        ? this.state.start.x
        : 0),
      y: this.state.start.y + oldLines.length - 1
    });
    this.editor.applyingChangeState = false;
    return editor;
  }
});
Editor.prototype._initChangeStack = function () {
  var self = this;
  self.changeStack = new Undo.Stack();
  self.on('change', function (newText, start, end, load, oldText) {
    if (load) {
      self.changeStack.stackPosition = -1;
      self.changeStack._clearRedo();
    } else if (!self.applyingChangeState) { // FIXME: hack
      self.changeStack.execute(new Editor.ChangeCommand(self, {
        newText: newText,
        oldText: oldText,
        start: start,
        end: end,
        cursor: self.cursor(),
        startSelection: self.startSelection(),
        scroll: self.scroll()
      }));
    }
  });
  return self;
};

Editor.prototype._initHighlighting = function () {
  var self = this;

  self.data.markup = {lines: [''], revision: 0, bucket: highlightClient.getBucket()};

  self.on('change', function (change, start, end) {
    // update markup with un-marked up change before it is highlighted for faster rendering
    var dataMarkup = self.data.markup;
    textUtil.spliceLines(dataMarkup.lines,
      _(start).merge({x: markup.index(dataMarkup.lines[start.y] || '', start.x)}).toObject(),
      _(end).merge({x: markup.index(dataMarkup.lines[end.y] || '', end.x)}).toObject(),
      textUtil._getLines(blessed.escape(change)));
    dataMarkup.revision++;
    self.screen.render();

    highlightClient.send({
      type: 'highlight',
      text: self.text(),
      language: self.language(),
      style: self.options.style,
      revision: dataMarkup.revision,
      bucket: dataMarkup.bucket
    });
  });

  highlightClient.on('message', function (data) {
    if (data.bucket === self.data.markup.bucket && data.revision >= self.data.markup.revision) {
      self.data.markup = data;
      self.screen.render(); // self.parent.render()
    }
  });

  return self;
};
Editor.prototype._initHandlers = function () {
  var self = this;

  self.on('keypress', function (ch, key) {
    if (key.name === 'mouse') return;
    self.data.mouseDown = false;

    var selection = self.select();
    var binding = util.getBinding(self.options.bindings, key);
    if (binding === 'indent' && key.full === 'tab' && selection.start.y === selection.end.y) {
      binding = false;
    }

    logger.debug('key %s binding %s', JSON.stringify(ch), binding, key);

    if (!binding || !['go', 'select', 'delete'].some(function (action) {
      if (binding.indexOf(action) === 0) {
        var directionDistance = binding.slice(action.length);
        return _({
          All: false, MatchingBracket: false,
          Left: -1, Right: 1,
          Up: -2, Down: 2
        }).pairs().some(function (directionPair) {
          var directionName = directionPair[0];
          var directionAxis = directionPair[1];
          if (directionDistance.indexOf(directionName) === 0) {
            var moved = true;
            var startCursor = self.cursor();

            if (directionName === 'All') {
              startCursor = Coordinate.origin();
              self.cursor(Coordinate.infinity());
            } else if (directionName === 'MatchingBracket') {
              var matchingBracket = self.matchingBracket();
              if (matchingBracket) self.cursor(matchingBracket);
              else moved = false;
            } else {
              var startSelection = self.startSelection();
              var cmp = startSelection && Coordinate.linear.cmp(startSelection, startCursor);
              if (action !== 'delete' || !cmp) {
                var axis = Math.abs(directionAxis);
                var direction = axis && directionAxis / axis;
                var distance = directionDistance.slice(directionName.length);
                switch (axis) {
                  case 1: // left/right
                    switch (distance) {
                      case '':
                        if (action === 'go' && cmp === direction) {
                          self.cursor(startSelection);
                        } else {
                          self.moveCursorHorizontal(direction);
                        }
                        break;
                      case 'Word': self.moveCursorHorizontal(direction, true); break;
                      case 'Infinity':
                        var firstNonWhiteSpaceX = (self.line().match(/^\s*/) || [''])[0].length;
                        self.cursor({
                          x: direction === -1
                            ? startCursor.x === firstNonWhiteSpaceX
                              ? 0
                              : firstNonWhiteSpaceX
                            : Infinity,
                          y: startCursor.y
                        });
                        break;
                      default: moved = false; break;
                    }
                    break;
                  case 2: // up/down
                    switch (distance) {
                      case '': self.moveCursorVertical(direction); break;
                      case 'Paragraph': self.moveCursorVertical(direction, true); break;
                      case 'Page': self.moveCursorVertical(direction * self.options.pageLines); break;
                      case 'Infinity':
                        self.cursor(Coordinate[direction === -1
                          ? 'origin'
                          : 'infinity']());
                        break;
                      default: moved = false; break;
                    }
                }
              }
            }
            if (moved) {
              if (action === 'go') {
                self.startSelection(null);
              } else {
                if (!selection.text) self.startSelection(startCursor);
                if (action === 'delete') self.delete();
              }
              return true;
            }
          }
        });
      }
    })) {
      switch (binding) {
        case 'selectLine':
        case 'deleteLine':
          var cursor = self.cursor();
          self.select(
            cursor.y === self.data.lines.length - 1
              ? {x: Infinity, y: cursor.y - 1}
              : {x: 0, y: cursor.y},
            {x: 0, y: cursor.y + 1}
          );
          if (binding === 'deleteLine') self.delete();
          self.cursor(cursor);
          break;
        case 'copy':
        case 'cut':
          self.copy();
          if (binding === 'cut') self.delete();
          break;
        case 'paste': self.paste(); break;
        case 'indent':
        case 'dedent':
          self.indent(selection.start, selection.end, binding === 'dedent'); break;
        case 'undo': self.changeStack.canUndo() && self.changeStack.undo(); break;
        case 'redo': self.changeStack.canRedo() && self.changeStack.redo(); break;
        default:
          if (!binding && !key.ctrl && ch) {
            var enterPressed = key.name === 'return' || key.name === 'linefeed';
            if (enterPressed) {
              ch = '\n' + self.line().match(/^( |\t)*/)[0];
              if (!self.options.multiLine) return;
            } else if (key.name === 'enter') {
              return; // blessed remaps keys -- ch and key.sequence here are '\r'
            } else if (ch === '\t') {
              ch = self._getTabString();
            } else if (ch === '\x1b') { // escape
              return;
            }

            if (selection.text) {
              self.change(ch);
            } else {
              var cursor = self.cursor();
              var lastCharacter = (self.line()[cursor.x] || '\n').match(textUtil._lineRegExp);
              var overwrite = !lastCharacter && !enterPressed;
              var lastEl = self;
              while (lastEl = lastEl.parent) {
                if (typeof lastEl.insertMode === 'function') {
                  overwrite &= !lastEl.insertMode();
                  break;
                }
              }
              self.change(ch, cursor, _(cursor).merge({x: cursor.x + overwrite}).toObject());
            }
          }
          break;
      }
    }
  });

  self.on('mouse', function (mouseData) {
    var mouse = self.realPos(Coordinate(mouseData)
          .subtract(self.bufferPos())
          .add(self.scroll()));

    if (mouseData.action === 'wheeldown' || mouseData.action === 'wheelup') {
      self.scroll(Coordinate(self.scroll()).add({
        x: 0,
        y: {
          wheelup: -1,
          wheeldown: 1
        }[mouseData.action] * self.options.pageLines
      }));
    } else {
      if (mouseData.action === 'mousedown') {
        var lastClick = self.data.lastClick;
        self.data.lastClick = mouse;
        clearTimeout(self.data.doubleClickTimer);
        self.data.doubleClickTimer = setTimeout(function () {
          self.data.lastClick = null;
        }, self.options.doubleClickDuration);
        if (lastClick && Coordinate.linear.cmp(lastClick, mouse) === 0) {
          self.data.lastClick = null;
          var line = self.line(mouse.y);
          var startX = mouse.x;
          var endX = mouse.x + 1;
          var prev = word.prev(line, mouse.x);
          var current = word.current(line, mouse.x);
          if (current) {
            if (prev && current.index < prev.index + prev[0].length) {
              startX = prev.index;
              endX = prev.index + prev[0].length;
            } else if (current.index <= mouse.x && mouse.x < current.index + current[0].length) {
              startX = current.index;
              endX = current.index + current[0].length;
            }
          }
          self.select({x: startX, y: mouse.y}, {x: endX, y: mouse.y});
        } else {
          if (!self.data.mouseDown) {
            self.data.hideSelection = true;
            self.startSelection(mouse);
            self.data.hideSelection = false;
          }
          self.data.mouseDown = true;
        }
      }
      if (self.data.mouseDown) self.cursor(mouse);
      if (mouseData.action === 'mouseup') self.data.mouseDown = false;
    }
  });

  self.on('cursor', function (cursor) {
    cursor = Coordinate(self.visiblePos(cursor));
    var cursorPadding = self.options.cursorPadding || {};
    var minScroll = cursor
      .subtract({x: cursorPadding.left || 0, y: cursorPadding.top || 0});
    var maxScroll = cursor
      .subtract(self.bufferSize())
      .add({x: cursorPadding.right || 0, y: cursorPadding.bottom || 0})
      .add({x: 1, y: 1});

    self.scroll(Coordinate.max(Coordinate.min(self.scroll(), minScroll), maxScroll));
  });

  ['cursor', 'startSelection'].forEach(function (evt) {
    self.on(evt, function () {
      if (self.screen.focused === self) {
        var selection = self.select();
        var line = self.line(selection.end.y);

        self.data.matches = selection.text.match(/^[\w.-]+$/)
            && selection.start.y === selection.end.y
            && (line[selection.start.x - 1] || ' ').match(/\W/)
            && (line[selection.end.x] || ' ').match(/\W/)
          ? self.findAll(new RegExp('\\b'+textUtil.escapeRegExp(selection.text)+'\\b'))
          : [];
      }
    });
  });

  ['scroll', 'startSelection'].forEach(function (evt) {
    self.on(evt, function () { self.screen.render(); });
  });

  return self;
};
Editor.prototype._updateCursor = function () {
  var self = this;
  var scroll = self.scroll();
  var cursorOnScreen = Coordinate(self.visiblePos(self.cursor()))
    .add(self.bufferPos())
    .subtract(self.scroll());
  if (cursorOnScreen.subtract(self.bufferPos()).within(Coordinate.origin(), self.bufferSize()) && self === self.screen.focused) {
    self.screen.program.move(cursorOnScreen.x, cursorOnScreen.y);
    self.screen.program.showCursor();
  } else {
    self.screen.program.hideCursor();
  }
};
Editor.prototype._renderableTabString = function (match) {
  return !this.options.visibleWhiteSpace
    ? _.repeat(' ', this.options.tabSize * match.length).join('')
    : markup(_.repeat(
        _.repeat('\u2500', this.options.tabSize - 1).join('') +
        (this.options.tabSize ? '\u2574' : '')
      , match.length).join(''), this.options.style.whiteSpace)
};
Editor.prototype._renderableSpace = function (match) {
  return !this.options.visibleWhiteSpace
    ? match
    : markup(_.repeat('\u00b7', match.length).join(''), this.options.style.whiteSpace);
};
Editor.prototype._renderableLineEnding = function (lineEnding) {
  return !this.options.visibleLineEndings
    ? ''
    : markup(lineEnding
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
     , this.options.style.whiteSpace);
};
Editor._nonprintableRegExp = /[\x00-\x1f]|\x7f/g;
Editor.prototype.render = function () {
  var self = this;

  var scroll = self.scroll();
  var size = self.bufferSize();
  var cursor = self.cursor();
  var selection = self.select();
  var matchingBracket = self.matchingBracket(cursor);
  var cursorOnBracket = !selection.text && matchingBracket !== undefined;
  var visibleCursor = self.visiblePos(cursor);
  var visibleSelection = self.visiblePos(selection);
  var visibleMatchingBracket = !selection.text && matchingBracket && self.visiblePos(matchingBracket);
  var visibleMatches = (self.data.matches || []).map(function (match) {
    return self.visiblePos(match);
  });

  var style = self.options.style;
  var selectionStyle = style.selection;
  var matchStyle = style.match;
  var bracketStyle = matchingBracket && matchingBracket.match ? style.matchingBracket : style.mismatchedBracket;

  var gutterWidth = self.gutter.width;
  var lineNumberWidth = self.gutter.options.lineNumberWidth;
  var currentLineStyle = self.gutter.options.style.currentLine;

  var bufferContent = [];
  var gutterContent = [];

  self.data.markup.lines
    .slice(scroll.y, scroll.y + size.y)
    .forEach(function (line, y) {
      var x = scroll.x;
      y += scroll.y;

      var renderableLineEnding = self._renderableLineEnding((line.match(textUtil._lineRegExp) || [''])[0]);
      line = line
        .replace(/\t+/g, self._renderableTabString.bind(self))
        .replace(/ +/g, self._renderableSpace.bind(self))
        .replace(textUtil._lineRegExp, renderableLineEnding)
        .replace(Editor._nonprintableRegExp, '\ufffd');

      var markupScrollX = markup.index(line, x);
      line = markup.getOpenTags(line.slice(0, markupScrollX)).join('') +
        line.slice(markupScrollX, markup.index(line, x + size.x)) +
        _.repeat(' ', size.x).join('');

      if (!self.data.hideSelection && selectionStyle && visibleSelection.start.y <= y && y <= visibleSelection.end.y) {
        line = markup(line, selectionStyle,
          y === visibleSelection.start.y ? visibleSelection.start.x - x : 0,
          y === visibleSelection.end.y ? visibleSelection.end.x - x : Infinity);
      }

      if (cursorOnBracket && y === visibleCursor.y) {
        line = markup(line, bracketStyle,
          visibleCursor.x - x,
          visibleCursor.x - x + 1);
      }
      if (visibleMatchingBracket && y === visibleMatchingBracket.y) {
        line = markup(line, bracketStyle,
          visibleMatchingBracket.x - x,
          visibleMatchingBracket.x - x + 1);
      }

      visibleMatches.forEach(function (match) {
        if (match.start.y <= y && y <= match.end.y) {
          line = markup(line, matchStyle,
            y === match.start.y ? match.start.x - x : 0,
            y === match.end.y ? match.end.x - x : Infinity);
        }
      });

      bufferContent.push(line + '{/}');

      var gutterLine = (_.repeat(' ', lineNumberWidth).join('') + (y + 1)).slice(-lineNumberWidth);
      gutterLine += _.repeat(' ', gutterWidth).join('');

      if (currentLineStyle && y === visibleCursor.y) {
        gutterLine = markup(gutterLine, currentLineStyle);
      }

      gutterContent.push(gutterLine + '{/}');
    });

  self.buffer.setContent(bufferContent.join('\n'));
  self.gutter.setContent(gutterContent.join('\n'));

  return blessed.Box.prototype.render.apply(self, arguments);
};

module.exports = Editor;
