var _ = require('lazy.js');
var extend = require('xtend');
var blessed = require('blessed');
var clipboard = require('copy-paste').noConflict();
var Undo = require('undo.js');
var fork = require('child_process').fork;
var path = require('path');

var util = require('./util');
var word = require('./word');
var Coordinate = require('./coordinate');
var markup = require('./markup');

function Editor (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) { return new Editor(opts); }

  blessed.Box.call(self, extend({
    tags: true,
    wrap: false
  }, opts));

  self.changeStack = new Undo.Stack();

  self
    .toggleInsertMode()
    .text('', true)
    .cursor({x: 0, y: 0})
    .scroll({x: 0, y: 0})
    ._initHighlightProcess()
    ._initHandlers();
}
Editor.prototype.__proto__ = blessed.Box.prototype;

Editor.prototype._initHighlightProcess = function () {
  var self = this;

  self.highlightProcess = fork(path.join(__dirname, 'highlightProcess.js'));

  self.on('text', function (text) {
    self.highlightProcess.send({
      text: text,
      language: self.language(),
      style: self.options.style
    });
  });

  self.highlightProcess.on('message', function (data) {
    self.data.markup = data;
    self._editorRender();
  });

  self.highlightProcess.on('exit', function () { self._initHighlightProcess(); });
  self.highlightProcess.on('error', function (err) { throw err; });

  return self;
};

Editor.prototype._initHandlers = function () {
  var self = this;

  self.on('keypress', function (ch, key) {
    var selection = self.select();

    var binding = util.getBinding(self.options.bindings, key);
    if (binding === 'indent' && key.full === 'tab' && selection.start.y === selection.end.y) {
      binding = false;
    }

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
              if (matchingBracket) { self.cursor(matchingBracket); }
              else { moved = false; }
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
                      case 'Infinity': self.cursor({x: direction === -1 ? 0 : Infinity, y: startCursor.y}); break;
                      default: moved = false; break;
                    }
                    break;
                  case 2: // up/down
                    switch (distance) {
                      case '': self.moveCursorVertical(direction); break;
                      case 'Paragraph': self.moveCursorVertical(direction, true); break;
                      case 'Page': self.moveCursorVertical(direction * self.options.pageLines); break;
                      case 'Infinity': self.cursor(Coordinate[direction === -1 ? 'origin' : 'infinity']()); break;
                      default: moved = false; break;
                    }
                }
              }
            }
            if (moved) {
              if (action === 'go') {
                self.startSelection(null);
              } else {
                if (!selection.text) { self.startSelection(startCursor); }
                if (action === 'delete') { self.delete(); }
              }
              return true;
            }
          }
        });
      }
    })) {
      switch (binding) {
        case 'copy':
        case 'cut':
          if (selection.text) { clipboard.copy(selection.text); }
          if (binding === 'cut') { self.delete(); }
          break;
        case 'paste':
          clipboard.paste(function (err, text) {
            if (err) { throw err; }
            self.change(text);
          });
          break;
        case 'indent':
        case 'dedent':
          self.indent(selection.start, selection.end, binding === 'dedent'); break;
        case 'undo': self.changeStack.canUndo() && self.changeStack.undo(); break;
        case 'redo': self.changeStack.canRedo() && self.changeStack.redo(); break;
        case 'toggleInsertMode': self.toggleInsertMode(); break;
        default:
          if (!binding && !key.ctrl && ch) {
            if (ch === '\r') {
              // FIXME: hack
              ch = '\n';
              if (self.data.enterPressed) { return; }
              self.data.enterPressed = true;
              process.nextTick(function () { self.data.enterPressed = false; });
            } else if (ch === '\t') {
              ch = self._getTabString();
            }

            if (selection.text) {
              self.change(ch);
            } else {
              var overwrite = !self.insertMode() && !self.data.enterPressed;
              var cursor = self.cursor();
              self.change(ch, cursor, extend(cursor, {x: cursor.x + overwrite}));
            }
          }
          break;
      }
    }
  });

  self.on('mouse', function (mouseData) {
    var mouse = Coordinate(mouseData).subtract(self.pos()).add(self.scroll());

    if (mouseData.action === 'wheeldown' || mouseData.action === 'wheelup') {
      if (!mouseData.shift && !self.data.mouseDown) {
        self.startSelection(null);
      } else if (!self.startSelection()) {
        self.startSelection(self.cursor());
      }
      self.moveCursorVertical({
        wheelup: -1,
        wheeldown: 1
      }[mouseData.action] * self.options.pageLines);
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
          if (prev) {
            if (prev.index < mouse.x && mouse.x < prev.index + prev[0].length) {
              startX = prev.index;
              endX = prev.index + prev[0].length;
            } else {
              var current = word.current(line, mouse.x);
              if (current && current.index === mouse.x) {
                startX = current.index;
                endX = current.index + current[0].length;
              }
            }
          }
          self.select({x: startX, y: mouse.y}, {x: endX, y: mouse.y});
        } else {
          if (!self.data.mouseDown) { self.startSelection(mouse); }
          self.data.mouseDown = true;
        }
      }
      if (self.data.mouseDown) {
        self.cursor(mouse);
      }
      if (mouseData.action === 'mouseup') {
        self.data.mouseDown = false;
      }
    }
  });

  self.on('focus', function () {
    self.screen.program.showCursor();
  });

  self.on('cursor', function (cursor) {
    var scroll = Coordinate.min(self.scroll(), cursor);
    var maxScroll = Coordinate(cursor).subtract(self.size()).add({x: 1, y: 1});
    scroll = Coordinate.max(scroll, maxScroll);

    self.scroll(scroll);
  });

  self.on('change', function (change, start, end, load) {
    var changeState = {
      text: self.text(), // FIXME: use change, start, end instead
      cursor: self.cursor(),
      startSelection: self.startSelection(),
      scroll: self.scroll()
    };
    if (load) {
      self.changeStack.stackPosition = -1;
      self.changeStack._clearRedo();
      self.data.lastChangeState = changeState;
    } else if (!self.applyingChangeState) { // FIXME: hack
      self.changeStack.execute(new Editor.ChangeCommand(self, self.data.lastChangeState, changeState));
      self.data.lastChangeState = changeState;
    }
  });

  self.on('lines', function (lines) {
    self.data.maxWidth = Math.max.apply(Math, _(lines).pluck('length').toArray());
  });

  // Render events
  self.on('scroll', function (scroll) { self._editorRender(); });
  self.on('startSelection', function (selection) { self._editorRender(); });

  return self;
};

Editor._lineRegExp = /\r\n|\r|\n/;
Editor.stripLine = function (line) {
  return line.replace(Editor._lineRegExp, '');
};
Editor.splitLines = function (text) {
  var lines = [];
  var match, line;
  while (match = Editor._lineRegExp.exec(text)) {
    line = text.slice(0, match.index) + match[0];
    text = text.slice(line.length);
    lines.push(line);
  }
  lines.push(text);
  return lines;
};
Editor.textRange = function (text, start, end) {
  start = start || Coordinate.origin();
  end = end || Coordinate.infinity();
  return typeof text === 'string' ? Editor.splitLines(text) : text
    .slice(start.y, end.y + 1)
    .map(function (line, i) {
      if (i + start.y === end.y) { line = line.slice(0, end.x); }
      if (i === 0) { line = line.slice(start.x); }
      return line;
    }).join('');
};
Editor.find = function (text, pattern, start, end) {
  var textRange = Editor.textRange.apply(null, [
    text
  ].concat(util.toArray(arguments).slice(2)));

  var match = textRange.match(pattern);
  if (!match) return;

  var result = start || {x: 0, y: 0};
  Editor.splitLines(textRange).some(function (line, y) {
    if (0 <= match.index && match.index < line.length) {
      result.x += match.index;
      result.y += y;
      return true;
    }
    match.index -= line.length;
  });
  return result;
};

Editor.prototype._getTabString = function () {
  return this.options.useSpaces ? _.repeat(' ', this.options.tabSize).join('') : '\t';
};
Editor.prototype.line = function (n, stripLineEnding) {
  var line = this.data.lines[arguments.length
    ? Math.max(Math.min(n, this.data.lines.length - 1), 0)
    : this.cursor().y
  ];
  if (stripLineEnding) { line = Editor.stripLine(line); }
  return line;
};
Editor.prototype.lines = function () { return util.toArray(this.data.lines); };
Editor.prototype.language = util.getterSetter('language', null, null);
Editor.prototype.text = function (text, load) {
  var self = this;

  if (arguments.length) {
    var start = Coordinate.origin();
    start.load = load;
    var end = Coordinate.infinity();
    return self.change(text.toString(), start, end);
  } else {
    return self.data.lines.join('');
  }
};
Editor.prototype.change = function (text, start, end) {
  var self = this;

  if (arguments.length < 3) {
    if (arguments.length === 1) { start = self.select(); }
    end = start.end; start = start.start;
  }

  var lines = self.data.lines;
  if (!lines) { self.data.lines = lines = ['']; }
  var textLines = Editor.splitLines(text);
  textLines.unshift(self.line(start.y).slice(0, start.x) + (textLines.shift() || ''));
  textLines.push(textLines.pop() + self.line(end.y).slice(end.x));

  [].splice.apply(lines, [start.y, end.y - start.y + 1].concat(textLines));

  self.select(null, start);
  if (!start.load) self.moveCursorHorizontal(text.length);
  else { self.data.markup = ''; }
  self.emit('change', text, start, end, start.load);
  self.emit('lines', util.toArray(lines), start.load);
  self.emit('text', self.text(), start.load);
  return this;
};
Editor.prototype.delete = function () {
  return this.change.apply(this, [''].concat(util.toArray(arguments)));
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
        if (i + start.y === cursor.y) { cursor.x += lengthDifference; }
        if (startSelection && i + start.y === startSelection.y) { startSelection.x += lengthDifference; }

        return newLine;
      })
      .join('')
    , {x: 0, y: start.y}, {x: 0, y: end.y + 1})
  .select(startSelection, cursor);
};

Editor.ChangeCommand = Undo.Command.extend({
  constructor: function (editor, oldState, newState) {
    this.editor = editor;
    this.oldState = oldState;
    this.newState = newState;
  },
  execute: function () {},
  undo: function () { this.apply(this.oldState); },
  redo: function () { this.apply(this.newState); },

  apply: function (changeState) {
    this.editor.applyingChangeState = true;
    this.editor
      .text(changeState.text)
      .select(changeState.startSelection, changeState.cursor)
      .scroll(changeState.scroll);
    this.editor.applyingChangeState = false;
  }
});

Editor.prototype.visiblePos = function (pos) {
  return {
    x: this.line(pos.y)
      .slice(0, pos.x)
      .replace(/\t/g, _.repeat('\t', this.options.tabSize).join(''))
      .length,
    y: pos.y
  };
};
Editor.prototype.realPos = function (pos) {
  return {
    x: this.line(pos.y)
      .replace(/\t/g, _.repeat('\t', this.options.tabSize).join(''))
      .slice(0, pos.x)
      .replace(new RegExp('\\t{1,'+this.options.tabSize+'}', 'g'), '\t')
      .length,
    y: pos.y
  };
};

Editor.prototype.scroll = util.getterSetter('scroll', util.clone, Coordinate.setter(function (c) {
  if (!this.data.maxWidth) { this.data.maxWidth = 0; }
  return {
    x: this.data.maxWidth,
    y: this.data.lines.length
  };
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

        if (!(0 <= cursor.y && cursor.y < self.data.lines.length - 1)) { break; }
        if (/^\s*$/g.test(self.line(cursor.y, true))) { break; }
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

Editor.prototype.insertMode = util.getterSetter('insertMode', null, Boolean);
Editor.prototype.toggleInsertMode = function () { return this.insertMode(!this.insertMode()); };

Editor.prototype.startSelection = util.getterSetter('startSelection', function (c) {
  return c ? util.clone(c) : null;
}, function (c) {
  if (c === null) { return null; }
  return cursorSetter.apply(this, arguments);
});

Editor.prototype.select = function (start, end) {
  var self = this;

  if (arguments.length) {
    if (arguments.length === 1) {
      if (start === null) { return self.startSelection(start); }
      end = start;
      start = self.cursor();
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
      text: Editor.textRange(self.data.lines, selectionBounds[0], selectionBounds[1])
    };
  }
};

Editor._bracketsRegExp = /((\()|(\[)|(\{))|((\))|(\])|(\}))/;
Editor.prototype.matchingBracket = function (pos) {
  var self = this;

  pos = pos || self.cursor();
  var bracket = (self.line(pos.y)[pos.x] || '').match(Editor._bracketsRegExp);
  if (!bracket) { return; }
  var start = !!bracket[1];
  var _half = (bracket.length - 3)/2 + 1;
  var matchIndex = bracket.reduce(function (memo, match, i) {
    if (!memo && [0, 1, _half + 1].indexOf(i) === -1 && match) {
      memo = i + _half*(start ? 1 : -1);
    }
    return memo;
  }, 0);

  var lines = Editor.splitLines(start
    ? Editor.textRange(self.data.lines, pos)
    : Editor.textRange(self.data.lines, Coordinate.origin(), {x: pos.x + 1, y: pos.y}));

  if (!start) { lines.reverse(); }

  var bracketCount = 0;
  var result = {};
  lines.some(function (line, y) {
    var x = start ? -1 : Infinity;
    while (true) {
      x = start
        ? util.regExpIndexOf(line, Editor._bracketsRegExp, x + 1)
        : util.regExpLastIndexOf(line.slice(0, x), Editor._bracketsRegExp);
      if (x === -1) { break; }
      var match = line[x].match(Editor._bracketsRegExp);
      bracketCount += match[1] ? 1 : -1;
      if (bracketCount === 0) {
        result.x = x + (start && y === 0 && pos.x);
        result.y = pos.y + (start ? y : -y);
        result.match = !!match[matchIndex];
        return true;
      }
    }
  });
  return result;
};

Editor.prototype.pos = function () {
  return {
    x: this.left + this.ileft,
    y: this.top + this.itop
  };
};

Editor.prototype.size = function () {
  return {
    x: this.width - this.iwidth,
    y: this.height - this.iheight
  };
};

Editor.prototype._updateCursor = function () {
  var self = this;
  var cursorOnScreen = Coordinate(self.pos()).add(self.visiblePos(self.cursor())).subtract(self.scroll());
  self.screen.program.move(cursorOnScreen.x, cursorOnScreen.y);
};
Editor.prototype._editorRender = function () {
  var self = this;

  var cursor = self.cursor();
  var scroll = self.scroll();
  var size = self.size();
  var selection = self.select();
  var matchingBracket = !selection.text && self.matchingBracket(cursor);

  var selectionStyle = self.options.style.selection;
  var currentLineStyle = self.options.style.currentLine;
  var matchingBracketStyle = self.options.style.matchingBracket;
  var mismatchedBracketStyle = self.options.style.mismatchedBracket;

  self.setContent(Editor.splitLines(self.data.markup)
//    .concat(_.repeat('', self.size().y).toArray())
    .slice(scroll.y, scroll.y + size.y)
    .map(function (line, y) {
      y += scroll.y;

      line = Editor.stripLine(line) + _.repeat(' ', Math.max(self.data.maxWidth, size.x)).join('');

      if (selectionStyle && selection.start.y <= y && y <= selection.end.y) {
        var startX = y === selection.start.y ? selection.start.x : 0;
        var endX = y === selection.end.y ? selection.end.x : Infinity;
        line = markup.markupLine(line, selectionStyle, startX, endX);
      }

      if (matchingBracket) {
        var style = matchingBracket.match
          ? matchingBracketStyle
          : mismatchedBracketStyle;
        if (y === cursor.y) {
          line = markup.markupLine(line, style, cursor.x, cursor.x + 1);
        }
        if (y === matchingBracket.y) {
          line = markup.markupLine(line, style, matchingBracket.x, matchingBracket.x + 1);
        }
      }

      if (currentLineStyle && y === cursor.y) {
        line = markup.markupLine(line, currentLineStyle);
      }

      var markupScrollX = markup.markupIndex(line, scroll.x);
      return markup.getOpenTags(line.slice(0, markupScrollX)).join('') + line.slice(
        markupScrollX,
        markup.markupIndex(line, scroll.x + size.x)
      ) + '{/}';
    })
    .join('\n'));

  self.screen.render();

  return self;
};

module.exports = Editor;
