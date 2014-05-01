var _ = require('lazy.js');
var extend = require('xtend');
var blessed = require('blessed');
var clipboard = require('copy-paste').noConflict();
var Undo = require('undo.js');
var spawn = require('child_process').spawn;
var es = require('event-stream');
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
    wrap: false,

    // Custom
    useSpaces: false,
    tabSize: 4,
    pageLines: 10,
    doubleClickDuration: 600,
    style: {
      selection: '{cyan-bg}',
      currentLine: '{blue-bg}',

      keyword: '{red-fg}',
      built_in: '{yellow-fg}',

//      'function': '',
      title: '{underline}',
      params: '{bold}',

      number: '{green-fg}{bold}',
      string: '{green-fg}{bold}',
      regexp: '{green-fg}{bold}',
      literal: '{green-fg}{bold}',

      comment: '{light-white-fg}', // '{light-black-fg}',
    }
  }, opts));

  self.changeStack = new Undo.Stack();

  self
    .toggleInsertMode()
    .text('', true)
    .cursor({x: 0, y: 0})
    .scroll({x: 0, y: 0})
    ._initMarkupProcess()
    ._initHandlers();
}
Editor.prototype.__proto__ = blessed.Box.prototype;

Editor.prototype._initMarkupProcess = function () {
  var self = this;

  self.data.markup = '';
  self.markupProcess = spawn(path.join(__dirname, 'markupProcess.js'));

  var stdinJSON = es.stringify();
  stdinJSON.pipe(self.markupProcess.stdin);
  self.on('text', function (text) {
    stdinJSON.write({
      text: text,
      language: self.language(),
      style: self.options.style
    });
  });

  self.markupProcess.stdout
    .pipe(es.split())
    .pipe(es.parse())
    .pipe(es.map(function (data) {
      self.data.markup = data;
      self._editorRender();
    }));

  return self;
};

Editor.prototype._initHandlers = function () {
  var self = this;

  self.on('keypress', function (ch, key) {
    var ctrl = process.platform !== 'darwin' ? key.ctrl : key.meta;
    var selection = self.select();
    var direction = {
      left: -1, right: 1,
      up: -1, down: 1,
      pageup: -1, pagedown: 1,
      home: -1, end: 1,
      backspace: -1, 'delete': 1
    }[key.name];
    if (direction) {
      if (key.name === 'backspace' || key.name === 'delete') {
        if (!self.select().text) {
          self
            .startSelection(self.cursor())
            .moveCursorHorizontal(direction, ctrl);
        }
        self.delete(); return;
      }

      var prevSelection = self.startSelection();
      if (!key.shift) {
        self.startSelection(null);
      } else if (!prevSelection) {
        self.startSelection(self.cursor());
      }

      if (key.name === 'left' || key.name === 'right') {
        if (!key.shift && prevSelection && Coordinate.linear.cmp(prevSelection, self.cursor()) === direction) {
          self.cursor(prevSelection);
        } else {
          self.moveCursorHorizontal(direction, ctrl);
        }
      } else if (key.name === 'up' || key.name === 'down') {
        self.moveCursorVertical(direction, ctrl);
      } else if (key.name === 'pageup' || key.name === 'pagedown') {
        self.moveCursorVertical(direction * self.options.pageLines);
      } else if (key.name === 'home') {
        this.cursor({x: 0, y: self.cursor().y});
      } else if (key.name === 'end') {
        this.cursor({x: Infinity, y: self.cursor().y});
      }
    } else if (key.full === 'C-a') {
      self.select(Coordinate.returnsOrigin(), Coordinate.returnsInfinity());
    } else if (key.full === 'C-c' || key.full === 'C-x') {
      if (selection.text) { clipboard.copy(selection.text); }
      if (key.full === 'C-x') { self.delete(); }
    } else if (key.full === 'C-v') {
      clipboard.paste(function (err, text) {
        if (err) { throw err; }
        self.change(text);
      });
    } else if (key.full === 'C-z') {
      self.changeStack.canUndo() && self.changeStack.undo();
    } else if (key.full === 'C-y') {
      self.changeStack.canRedo() && self.changeStack.redo();
    } else if (key.name === 'tab' && (key.shift || selection.start.y !== selection.end.y)) {
      self.indent(selection.start, selection.end, key.shift);
    } else if (key.name === 'insert') {
      self.toggleInsertMode();
    } else if (!ctrl && ch) {
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
        setTimeout(function () { self.data.lastClick = null; }, self.options.doubleClickDuration);
        if (lastClick && Coordinate.linear.cmp(lastClick, mouse) === 0) {
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

  self.on('cursor', function (cursor) {
    var scroll = Coordinate.min(self.scroll(), cursor);
    var maxScroll = Coordinate(cursor).subtract(self.size()).add({x: 1, y: 1});
    scroll = Coordinate.max(scroll, maxScroll);

    self.scroll(scroll);
  });

  self.on('text', function (text, load) {
    // TODO: change undo support to use 'change' event
    var changeState = {
      text: text,
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

Editor.prototype.language = util.getterSetter('language', null, null);

Editor._lineRegExp = /\r\n|\r|\n/;
Editor._splitLines = function (text) {
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
Editor.prototype.lines = util.getterSetter('lines', util.toArray, util.toArray);
Editor.prototype.text = function (text, load) {
  if (arguments.length) {
    text = text.toString();
    this.emit('text', text, load);
    return this.lines(Editor._splitLines(text));
  } else {
    return this.data.lines.join('');
  }
};

Editor.prototype.line = function (n, stripLineEnding) {
  var line = this.data.lines[arguments.length
    ? Math.max(Math.min(n, this.data.lines.length - 1), 0)
    : this.cursor().y
  ];
  if (stripLineEnding) { line = line.replace(Editor._lineRegExp, ''); }
  return line;
};

Editor.prototype.textRange = function (start, end) {
  return this.data.lines
    .slice(start.y, end.y + 1)
    .map(function (line, i) {
      if (i + start.y === end.y) { line = line.slice(0, end.x); }
      if (i === 0) { line = line.slice(start.x); }
      return line;
    }).join('');
};

Editor.prototype._getTabString = function () {
  return this.options.useSpaces ? _.repeat(' ', this.options.tabSize).join('') : '\t';
};
Editor.prototype._changed = function (text, start, end) {
  this.emit('changed', text, start, end);
  this.emit('lines', this.lines()); // TODO: optimize
  this.emit('text', this.text()); // TODO: optimize
  return this;
};
Editor.prototype.change = function (text, start, end) {
  if (arguments.length < 3) {
    if (arguments.length === 1) { start = this.select(); }
    end = start.end; start = start.start;
  }

  var lines = Editor._splitLines(text);
  lines.unshift(this.line(start.y).slice(0, start.x) + (lines.shift() || ''));
  lines.push(lines.pop() + this.line(end.y).slice(end.x));

  [].splice.apply(this.data.lines, [start.y, end.y - start.y + 1].concat(lines));
  return this
    .select(null, start)
    .moveCursorHorizontal(text.length)
    ._changed(text, start, end);
};
Editor.prototype.delete = function () {
  return this.change.apply(this, [''].concat(util.toArray(arguments)));
};
Editor.prototype.indent = function (start, end, dedent) {
  var self = this;

  var cursor = self.cursor();
  var startSelection = self.startSelection();

  return self
    .change(self.lines()
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
  if (arguments.length) {
    if (arguments.length === 1) {
      if (start === null) { return this.startSelection(start); }
      end = start;
      start = this.cursor();
    }
    return this
      .startSelection(start)
      .cursor(end);
  } else {
    var cursor = this.cursor();
    var selectionBounds = [this.startSelection() || cursor, cursor];
    selectionBounds.sort(Coordinate.linear.cmp);
    return {
      start: selectionBounds[0],
      end: selectionBounds[1],
      text: this.textRange(selectionBounds[0], selectionBounds[1])
    };
  }
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
  var selectionStyle = self.options.style.selection;
  var currentLineStyle = self.options.style.currentLine;

  self.setContent(Editor._splitLines(self.data.markup)
//    .concat(_.repeat('', self.size().y).toArray())
    .slice(scroll.y, scroll.y + size.y)
    .map(function (line, y) {
      y += scroll.y;

      line = line.replace(Editor._lineRegExp, '') + _.repeat(' ', self.data.maxWidth).join('');

      if (selectionStyle && selection.start.y <= y && y <= selection.end.y) {
        var startX = y === selection.start.y ? selection.start.x : 0;
        var endX = y === selection.end.y ? selection.end.x : Infinity;
        line = markup.markupLine(line, selectionStyle, startX, endX);
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
