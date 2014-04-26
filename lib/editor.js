var _ = require('lazy.js');
var extend = require('xtend');
var blessed = require('blessed');
var clipboard = require('copy-paste').noConflict().silent();

var util = require('./util');
var word = require('./word');
var coordinate = require('./coordinate');

function Editor (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) { return new Editor(opts); }

  blessed.Box.call(self, extend({
    tags: true,
    wrap: false,

    // Custom
    pageLines: 10,
    selectStyle: '{blue-bg}'
  }, opts));

  self
    .text('')
    .cursor(0, 0)
    .scroll(0, 0)
    ._initHandlers();
}
Editor.prototype.__proto__ = blessed.Box.prototype;

Editor.prototype._initHandlers = function () {
  var self = this;

  self.on('keypress', function (ch, key) {
    var direction = {
      up: -1, down: 1,
      left: -1, right: 1,
      pageup: -1, pagedown: 1,
      home: -1, end: 1,
      backspace: -1, 'delete': 1
    }[key.name];
    if (direction) {
      if (key.name === 'backspace' || key.name === 'delete') {
        if (!self.select().text) {
          self
            .startSelection(self.cursor())
            .moveCursorHorizontal(direction, key.ctrl);
        }
        self.delete(); return;
      }

      var prevSelection = self.startSelection();
      if (!key.shift && !self._mouseDown) {
        if (prevSelection && coordinate.linear.cmp(prevSelection, self.cursor()) === direction) {
          self.cursor(prevSelection);
        }
        self.startSelection(null);
      } else if (!prevSelection) {
        self.startSelection(self.cursor());
      }

      if (key.name === 'up' || key.name === 'down') {
        self.moveCursorVertical(direction, key.ctrl);
      } else if (key.name === 'left' || key.name === 'right') {
        self.moveCursorHorizontal(direction, key.ctrl);
      } else if (key.name === 'pageup' || key.name === 'pagedown') {
        self.moveCursorVertical(direction * self.options.pageLines);
      } else if (key.name === 'home') {
        this.cursor(0, self.cursor().y);
      } else if (key.name === 'end') {
        this.cursor(Infinity, self.cursor().y);
      }
    } else if (key.full === 'C-c' || key.full === 'C-x') {
      var selection = self.select();
      if (selection.text) { clipboard.copy(selection.text); }
      if (key.full === 'C-x') { self.delete(); }
    } else if (key.full === 'C-v') {
      clipboard.paste(function (err, text) {
        if (err) { throw err; }
        self.change(text);
      });
    } else if (!key.ctrl && key.sequence) {
      if (key.sequence === '\r') {
        // FIXME: hack
        if (self._enterPressed) { return; }
        self._enterPressed = true;
        process.nextTick(function () { self._enterPressed = false; });
      }
      self.change(key.sequence);
    }
  });

  self.on('mouse', function (data) {
    var mouse = coordinate.add(coordinate.subtract(data, self.pos()), self.scroll());

    if (data.action === 'wheeldown' || data.action === 'wheelup') {
      if (!data.shift && !self._mouseDown) {
        self.startSelection(null);
      } else if (!self.startSelection()) {
        self.startSelection(self.cursor());
      }
      self.moveCursorVertical({
        wheelup: -1,
        wheeldown: 1
      }[data.action] * self.options.pageLines);
    } else {
      if (data.action === 'mousedown') {
        self._mouseDown = true;
        self.startSelection(mouse);
      }
      if (self._mouseDown) {
        self.cursor(mouse);
        self.preferredCursorX = self.cursor().x;
      }
      if (data.action === 'mouseup') {
        self._mouseDown = false;
        var startSelection = self.startSelection();
        if (startSelection && coordinate.linear.cmp(startSelection, mouse) === 0) {
          self.startSelection(null);
        }
      }
    }
  });

  self.on('cursor', function (cursor) {
    var scroll = coordinate.min(self.scroll(), cursor);
    var maxScroll = coordinate.add(coordinate.subtract(cursor, self.size()), {x: 1, y: 1});
    scroll = coordinate.max(scroll, maxScroll);

    self.scroll(scroll);
  });

  // Render events
  self.on('lines', function (lines) { self._editorRender(); });
  self.on('scroll', function (scroll) { self._editorRender(); });
  self.on('startSelection', function (selection) { self._editorRender(); });

  return self;
};

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
Editor.prototype.text = util.getterSetter('lines', function (lines) {
  return lines.join('');
}, function (text) {
  text = text.toString();
  this.emit('text', text);
  return Editor._splitLines(text); // implicitly emits lines event
});
Editor.prototype._textChanged = function () {
  this.emit('lines', this._lines.slice());
  this.emit('text', this._lines.join(''));
  return this;
};

Editor.prototype.line = function (n) {
  return this._lines[arguments.length
    ? Math.max(Math.min(n, this._lines.length - 1), 0)
    : this.cursor().y
  ];
};
Editor.prototype._visibleLine = function () {
  return this.line.apply(this, arguments).replace(Editor._lineRegExp, '');
};

Editor.prototype.textRange = function (start, end) {
  return this._lines
    .slice(start.y, end.y + 1)
    .map(function (line, i) {
      if (i + start.y === end.y) { line = line.slice(0, end.x); }
      if (i === 0) { line = line.slice(start.x); }
      return line;
    }).join('');
};

Editor.prototype.change = function (text, start, end) {
  if (arguments.length < 3) {
    if (arguments.length === 1) { start = this.select(); }
    end = start.end; start = start.start;
  }

  var lines = Editor._splitLines(text);
  lines.unshift(this.line(start.y).slice(0, start.x) + (lines.shift() || ''));
  lines.push(lines.pop() + this.line(end.y).slice(end.x));

  [].splice.apply(this._lines, [start.y, end.y - start.y + 1].concat(lines));
  return this
    .select(null, start)
    .moveCursorHorizontal(text.length)
    ._textChanged();
};
Editor.prototype.delete = function () {
  return this.change.apply(this, [''].concat([].slice.call(arguments)));
};

Editor.prototype.scroll = util.getterSetter('scroll', util.clone, coordinate.setter(function (c) {
  return {
    x: Math.max.apply(Math, _(this._lines).pluck('length').toArray()), // TODO: cache this
    y: this._lines.length
  };
}));

var cursorSetter = coordinate.setter(function (c) {
  var line = this._visibleLine(c.y);
  return {
    x: (line || '').length,
    y: this._lines.length - 1
  };
});

Editor.prototype.cursor = util.getterSetter('cursor', util.clone, cursorSetter);
Editor.prototype.moveCursorVertical = function (count, paragraphs) {
  var self = this;

  var cursor = self.cursor();

  if (paragraphs) {
    paragraphs = Math.abs(count);
    var direction = paragraphs / count;
    while (paragraphs--) {
      while (true) {
        cursor.y += direction;

        if (!(0 <= cursor.y && cursor.y < self._lines.length - 1)) { break; }
        if (/^\s*$/g.test(self._visibleLine(cursor.y))) { break; }
      }
    }
  } else {
    cursor.y += count;
  }

  cursor.x = Math.max(0, cursor.y < self._lines.length
    ? self.preferredCursorX || cursor.x
    : self._visibleLine().length
  );
  self.cursor(cursor);

  return self;
};
Editor.prototype.moveCursorHorizontal = function (count, words) {
  var self = this;

  var cursor = self.cursor();

  if (words) {
    words = Math.abs(count);
    var direction = words / count;
    while (words--) {
      var line = self._visibleLine(cursor.y);
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
          cursor.x = self._visibleLine(cursor.y).length;
        }
      } else {
        var restOfLineLength = self._visibleLine(cursor.y).length - cursor.x;
        if (count > restOfLineLength) {
          // Down a line
          count -= restOfLineLength + 1;
          if (cursor.y < self._lines.length - 1) {
            cursor.x = 0;
            cursor.y += 1;
          }
        } else {
          // Same line
          cursor.x += count;
          self.preferredCursorX = cursor.x;

          self.cursor(cursor);
          break;
        }
      }
    }
  }

  return self;
};

Editor.prototype.startSelection = util.getterSetter('startSelection', function (c) {
  return c ? util.clone(c) : c;
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
    selectionBounds.sort(coordinate.linear.cmp);
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

Editor._markupRegExp = /{(\/?)([\w\-,;!#]*)}/g;
Editor._realIndex = function (markup, index) {
  var i = 0;
  while (index > 0) {
    var match = Editor._markupRegExp.exec(markup);
    if (!match || match.index >= index) { break; }
    var accounted = match.index + match[0].length;
    markup = markup.slice(accounted);
    i += accounted;
    if (/^(open|close)$/g.test(match[2])) { i--; } // Account for { and } which replace {open} and {close}
    index -= match.index;
  }
  return i + index;
}

Editor.prototype._updateCursor = function () {
  var self = this;
  var cursorOnScreen = coordinate.add(self.pos(), coordinate.subtract(self.cursor(), self.scroll()));
  self.screen.program.move(cursorOnScreen.x, cursorOnScreen.y);
};
Editor.prototype._editorRender = function () {
  var self = this;

  var scroll = self.scroll();
  var selection = self.select();

  self.setContent(self._lines
//    .concat(_.repeat('', self.size().y).toArray())
    .slice(scroll.y, scroll.y + self.size().y)
    .map(function (line, y) {
      y += scroll.y;

      line = (line.replace(Editor._lineRegExp, '') + _.repeat(' ', self.size().x).join(''))
        .slice(scroll.x, scroll.x + self.size().x)
        .replace(/[{}]/g, function (match) {
          return {
            '{': '{open}',
            '}': '{close}'
          }[match];
        });

      if (selection && selection.start.y <= y && y <= selection.end.y) {
        var start = y === selection.start.y ? Editor._realIndex(line, selection.start.x - scroll.x) : 0;
        var end = y === selection.end.y ? Editor._realIndex(line, selection.end.x - scroll.x) : Infinity;
        line = [
          line.substring(0, start),
          self.options.selectStyle,
          line.substring(start, end),
          self.options.selectStyle.replace(Editor._markupRegExp, function (match) {
            return '{!' + match.slice(1);
          }),
          line.substring(end)
        ].join('');
      }

      return line;
    })
    .join('\n'));

  self.screen.render();

  return self;
};

module.exports = Editor;
