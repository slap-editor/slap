var _ = require('lazy.js');
var extend = require('xtend');
var EventEmitter = require('events').EventEmitter;
var blessed = require('blessed');
var clipboard = require('copy-paste').noConflict().silent();

var util = require('./util');
var coordinate = require('./coordinate');

util.inherits(Line, EventEmitter);
function Line (text) {
  EventEmitter.call(this);
  this.text(text);
}
Line.prototype.text = util.getterSetter('text');

util.inherits(Editor, EventEmitter);
function Editor (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) { return new Editor(opts); }

  blessed.Box.call(self, extend({
    tags: true,
    wrap: false,
    border: {type: 'line'},

    // Custom
    pageLines: 10,
    selectStyle: 'red-bg'
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

  self._mouseDown = false;

  self.on('keypress', function (ch, key) {
    var direction = {
      up: -1, down: 1,
      left: -1, right: 1,
      pageup: -1, pagedown: 1,
      home: -1, end: 1
    }[key.name];
    if (direction) {
      var distance = direction;

      if (!key.shift && !self._mouseDown) {
        self.startSelection(null);
      } else if (!self.startSelection()) {
        self.startSelection(self.cursor());
      }

      if (key.name === 'up' || key.name === 'down') {
        if (key.ctrl) {
          while (true) {
            var y = distance + self.cursor().y;

            if (!(0 <= y && y < self._lines.length - 1)) { break; }
            if (self.line(y).text().match(/^\s*$/g)) { break; }

            distance += direction;
          }
        }
        self.moveCursorVertical(distance);
      } else if (key.name === 'left' || key.name === 'right') {
        if (key.ctrl) {
          var line = self.line().text();
          distance = direction * Math.max({
            left: line.length - line.slice(0, self.cursor().x).search(/\W\w+$/),
            right: line.slice(self.cursor().x).search(/\W/)
          }[key.name], 1);
        }
        self.moveCursorHorizontal(distance);
      } else if (key.name === 'pageup' || key.name === 'pagedown') {
        self.moveCursorVertical(direction * self.options.pageLines);
      } else if (key.name === 'home' || key.name === 'end') {
        self.cursor(key.name === 'home' ? 0 : Infinity, self.cursor().y);
      }
    }
    if (key.full === 'C-c' || key.full === 'C-x') {
      var selection = self.select();
      if (selection.text) { clipboard.copy(selection.text); }
      if (key.full === 'C-x') { self.delete(); }
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

  self.on('lines', function (text) {
    self._editorRender();
  });

  self.on('scroll', function (scroll) {
    self._editorRender();
  });

  self.on('startSelection', function (selection) {
    self._editorRender();
  });
};

Editor.prototype.text = util.getterSetter('lines', null, function (text) {
  this.emit('text', text);
  return text.toString()
    .split(/\n/)
    .map(function (line) { return new Line(line); });
});
Editor.prototype.line = function (n) {
  return this._lines[arguments.length ? Math.max(Math.min(n, this._lines.length - 1), 0) : this.cursor().y];
};

Editor.prototype.scroll = util.getterSetter('scroll', util.clone, coordinate.setter(function (c) {
  return {
    x: Math.max.apply(Math, _(this._lines).invoke('text').pluck('length').toArray()), // TODO: cache this
    y: this._lines.length
  };
}));

var cursorSetter = coordinate.setter(function (c) {
  var line = this.line(c.y);
  return {
    x: (line ? line.text() : '').length,
    y: this._lines.length - 1
  };
});

Editor.prototype.cursor = util.getterSetter('cursor', util.clone, cursorSetter);
Editor.prototype.moveCursorVertical = function (rows) {
  var cursor = this.cursor();
  cursor.y += rows;
  cursor.x = 0 <= cursor.y
    ? cursor.y < this._lines.length
      ? this.preferredCursorX || cursor.x
      : this.line().text().length
    : 0;
  this.cursor(cursor);

  return this;
};
Editor.prototype.moveCursorHorizontal = function (columns) {
  var self = this;

  var cursor = self.cursor();
  while (true) {
    if (-columns > cursor.x) {
      // Up a line
      columns += cursor.x + 1;
      if (cursor.y > 0) {
        cursor.y -= 1;
        cursor.x = self.line(cursor.y).text().length;
      }
    } else {
      var restOfLineLength = self.line(cursor.y).text().length - cursor.x;
      if (columns > restOfLineLength) {
        // Down a line
        columns -= restOfLineLength + 1;
        if (cursor.y < self._lines.length - 1) {
          cursor.x = 0;
          cursor.y += 1;
        }
      } else {
        // Same line
        cursor.x += columns;
        self.preferredCursorX = cursor.x;

        self.cursor(cursor);
        return self;
      }
    }
  }
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

Editor.prototype.textRange = function (start, end) {
  return this._lines
    .slice(start.y, end.y + 1)
    .map(function (line, i) {
      var line = line.text();
      if (i + start.y === end.y) { line = line.slice(0, end.x); }
      if (i === 0) { line = line.slice(start.x); }
      return line;
    }).join('\n');
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

Editor.prototype.delete = function (start, end) {
  if (arguments.length < 2) {
    if (!arguments.length) { start = this.select(); }
    end = start.end; start = start.start;
  }

  this._lines[start.y] = new Line(
    this._lines[start.y].text().slice(0, start.x) +
    this._lines[end.y].text().slice(end.x));

  this._lines.splice(start.y + 1, end.y - start.y);
  return this.select(null, start);
}

var markupRegex = /{(\/?)([\w\-,;!#]*)}/;
Editor._realIndex = function (markup, index) {
  var i = 0;
  while (index > 0) {
    var match = markup.match(markupRegex);
    if (!match || match.index >= index) { break; }
    var accounted = match.index + match[0].length;
    markup = markup.slice(accounted);
    i += accounted;
    if (match[2].match(/(\/|!|no )?curly/)) { i--; } // Account for { and } which replace {curly} and {!curly}
    index -= match.index;
  }
  return i + index;
}

Editor.prototype._editorRender = function () {
  var self = this;

  var scroll = self.scroll();
  var selection = self.select();

  self.setContent(self._lines
//    .concat(_.repeat(new Line(''), self.size().y).toArray())
    .slice(scroll.y, scroll.y + self.size().y)
    .map(function (line, y) {
      y += scroll.y;
      line = (line.text() + _.repeat(' ', self.size().x).join(''))
        .slice(scroll.x, scroll.x + self.size().x)
        .replace(/[{}]/g, function (match) {
          return {
            '{': '{curly}',
            '}': '{!curly}'
          }[match];
        });

      if (selection && selection.start.y <= y && y <= selection.end.y) {
        var start = y === selection.start.y ? Editor._realIndex(line, selection.start.x - scroll.x) : 0;
        var end = y === selection.end.y ? Editor._realIndex(line, selection.end.x - scroll.x) : Infinity;
        line = line.substring(0, start) +
          '{'+self.options.selectStyle+'}' + line.substring(start, end) + '{!'+self.options.selectStyle+'}' +
          line.substring(end);
      }

      return line;
    })
    .join('\n'));

  var cursorOnScreen = coordinate.add(self.pos(), coordinate.subtract(self.cursor(), self.scroll()));
  self.screen.program.move(cursorOnScreen.x, cursorOnScreen.y);

  self.screen.render();

  return self;
};

module.exports = Editor;
