var fs = require('fs');
var _ = require('lazy.js');
var blessed = require('blessed');

var coordinate = require('./coordinate');
var util = require('./util');
var Editor = require('./editor');

function Program (rc) {
  var self = this;

  self.rc = rc;

  self.program = blessed.program();
  self.program.alternateBuffer();
  self.program.enableMouse();

  self.elements = {
    editor: new Editor(self).pos(0, 0)
  };

  self
    ._initHandlers()
    .keyboardFocus('editor')
    .render();
}
Program.prototype._initHandlers = function () {
  var self = this;

  self.program.key('C-q', function () {
    if (!self.keyboardFocusedElement().unfinished) {
      // FIXME: warn user focused element needs finishing
      self.exit();
    }
  });
  self.program.on('keypress', function (ch, key) {
    if (key.name !== 'mouse') { // Bug in blessed that mouse events come through the keypress handler only when a mouse handler exists
      self.keyboardFocusedElement().emit('keypress', ch, key);
    }
  });
  self.program.on('mouse', function (data) {
    var element = self.mouseFocusedElement();
    if (!element) {
      var name = self.elementAtCoordinate(data);
      element = self.elements[name];

      if (data.action === 'mousedown') {
        self.mouseFocus(name);
      }
    }

    if (element) {
      data.pos = coordinate.subtract(data, element.pos());
      element.emit('mouse', data);
    }

    if (data.action === 'mouseup') {
      self.mouseFocus(null);
    }
  });

  self.program.on('resize', function () {
    self.render();
  });

  return self;
};

Program.prototype.open = function (path) {
  var self = this;

  fs.readFile(path, function (err, data) {
    if (err) { throw err; }
    self.elements.editor.text(data);
  });

  return self;
};

Program.prototype.elementAtCoordinate = function (c) {
  var self = this;

  return _(self.elements)
    .keys()
    .dropWhile(function (name) {
      var element = self.elements[name];
      var pos = coordinate.subtract(c, element.pos());
      return !coordinate.within(pos, coordinate.returnsOrigin(), element.size());
    })
    .first();
};

Program.prototype.keyboardFocus = util.getterSetter('keyboardFocus', null, function (keyboardFocus) {
  if (this.elements.hasOwnProperty(keyboardFocus)) {
    return keyboardFocus;
  } else {
    return this.keyboardFocus();
  }
});
Program.prototype.keyboardFocusedElement = function () {
  return this.elements[this.keyboardFocus()];
};

Program.prototype.mouseFocus = util.getterSetter('mouseFocus', null, function (mouseFocus) {
  if (this.elements.hasOwnProperty(mouseFocus) || mouseFocus === null) {
    return mouseFocus;
  } else {
    return this.mouseFocus();
  }
});
Program.prototype.mouseFocusedElement = function () {
  return this.elements[this.mouseFocus()];
};

Program.prototype.exit = function () {
  this.program.clear();
  this.program.disableMouse();
  this.program.normalBuffer();
  process.exit(0);

  return this; // Just in case
};

Program.prototype.render = function (force) {
  this.program.clear();
  this.elements.editor
//    .pos(0, 0)
    .size(this.program.cols, this.program.rows - 1)
    .render(force);
//  this.elements.footer
//    .pos(0, this.program.rows - 1)
//    .size(this.program.cols, 1)
//    .render(force);

  return this;
};

module.exports = Program;
