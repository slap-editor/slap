var _ = require('lazy.js');
var EventEmitter = require('events').EventEmitter;

var util = require('./util');
var coordinate = require('./coordinate');

util.inherits(Line, EventEmitter);
function Line (text) {
  EventEmitter.call(this);
  this.text(text);
}
Line.prototype.text = util.getterSetter('text');

util.inherits(Editor, EventEmitter);
function Editor (program) {
  var self = this;
  EventEmitter.call(self);

  self.program = program;

  self
    .text('')
    .cursor(0, 0)
    .scroll(0, 0)
    .pos(0, 0)
    .size(0, 0)
    ._initHandlers();
}
Editor.prototype._initHandlers = function () {
  var self = this;

  self.on('keypress', function (ch, key) {
    var direction = {
      up: -1, down: 1,
      left: -1, right: 1,
      pageup: -1, pagedown: 1
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
      } else if (key.name === 'pageup' || key.name === 'pagedown') {
        self.moveCursorVertical(direction * self.program.rc.pageLines);
      } else if (key.name === 'left' || key.name === 'right') {
        if (key.ctrl) {
          var line = self.line().text();
          distance = direction * Math.max({
            left: line.length - line.slice(0, self.cursor().x).search(/\W\w+$/),
            right: line.slice(self.cursor().x).search(/\W/)
          }[key.name], 1);
        }
        self.moveCursorHorizontal(distance);
      }
    }
  });

  self._mouseDown = false;
  self.on('mouse', function (data) {
    var mouse = coordinate.add(data.pos, self.scroll());

    if (data.action === 'wheeldown' || data.action === 'wheelup') {
      if (!data.shift && !self._mouseDown) {
        self.startSelection(null);
      } else if (!self.startSelection()) {
        self.startSelection(self.cursor());
      }
      self.moveCursorVertical({
        wheelup: -1,
        wheeldown: 1
      }[data.action] * self.program.rc.pageLines);
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

  self.on('text', function (text) {
    self.render();
  });

  self.on('scroll', function (scroll) {
    self.render();
  });
};

Editor.prototype.text = util.getterSetter('text', null, function (text) {
  text = text.toString();
  this._lines = text.split(/\n/).map(function (line) { return new Line(line); });
  return text;
});
Editor.prototype.line = function (n) {
  return this._lines[arguments.length ? Math.max(Math.min(n, this._lines.length - 1), 0) : this.cursor().y];
};

Editor.prototype.pos = util.getterSetter('pos', util.clone, coordinate.setter());
Editor.prototype.size = util.getterSetter('size', util.clone, coordinate.setter());
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
      columns += cursor.x + 1;
      if (cursor.y > 0) {
        cursor.y -= 1;
        cursor.x = self.line(cursor.y).text().length;
      }
    } else {
      var restOfLineLength = self.line(cursor.y).text().length - cursor.x;
      if (columns > restOfLineLength) {
        columns -= restOfLineLength + 1;
        if (cursor.y < self._lines.length - 1) {
          cursor.x = 0;
          cursor.y += 1;
        }
      } else {
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
      end = start;
      start = this.cursor();
    }
    return this
      .startSelection(start)
      .cursor(end);
  } else {
    var startSelection = this.startSelection();
    if (!startSelection) { return null; }

    var selectionBounds = [startSelection, this.cursor()];
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

Editor.prototype.render = function () {
  var self = this;

  var program = self.program.program;

  var pos = self.pos();
  var size = self.size();
  var scroll = self.scroll();

//  program.move(pos.x, pos.y);
//  program.write(self._lines
//    .slice(scroll.y, scroll.y + size.y)
//    .map(function (line) {
//      return line.text().slice(scroll.x, scroll.x + size.x);
//    })
//    .join('\n'));

//  program.move(pos.x, pos.y);
//  program.write(self._lines
//    .concat(_.repeat(new Line(''), size.y).toArray())
//    .slice(scroll.y, scroll.y + size.y)
//    .map(function (line, y) {
//      var text = line.text() + _.repeat(' ', size.x).join('');
//      return text.slice(scroll.x, scroll.x + size.x);
//    })
//    .join('\n'));

  var selection = this.select();

  for (var y = scroll.y; y < scroll.y + size.y; y++) {
    var line = (this._lines[y] || new Line('')).text();
    line = line + _.repeat(' ', size.x).join('');
    line = line.slice(scroll.x, scroll.x + size.x);

    program.move(pos.x, y + pos.y - scroll.y);
    if (selection && selection.start.y <= y && y <= selection.end.y) {
      var isStartSelection = y === selection.start.y;
      var isEndSelection = y === selection.end.y;
      if (isStartSelection) {
        program.write(line.slice(0, selection.start.x));
      }
      program.bg('red');
      program.write(line.slice(!isStartSelection ? 0 : selection.start.x, !isEndSelection ? undefined : selection.end.x));
      program.bg('!red');
      if (isEndSelection) {
        program.write(line.slice(selection.end.x));
      }
    } else {
      program.write(line);
    }
  }

  var cursorOnScreen = coordinate.add(this.cursor(), coordinate.subtract(this.pos(), this.scroll()));
  program.move(cursorOnScreen.x, cursorOnScreen.y);

  return self;
};

module.exports = Editor;
