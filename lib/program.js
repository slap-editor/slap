var blessed = require('blessed');
var extend = require('xtend');
var fs = require('fs');

var Editor = require('./editor');

function Program (opts) {
  var self = this;

  self.opts = opts;

  self.screen = blessed.screen();

  self.editor = new Editor(extend({
    top: 0,
    left: 0,
    right: 0,
    bottom: 1,
    border: {type: 'line'}
  }, opts.editor));
  self.screen.append(self.editor);
  self.editor.focus();
  self.editor._editorRender(); // FIXME: hack

  self.screen.program.showCursor();

  self
    ._initHandlers()
    .render();
}
Program.prototype._initHandlers = function () {
  var self = this;

  self.screen.key(['escape', 'C-q'], function () {
    if (self.screen.focused.unfinished) {
      // FIXME: warn user focused element needs finishing
    } else {
      self.exit();
    }
  });

  self.screen.on('resize', function () {
    self.render();
  });

  return self;
};

Program.prototype.open = function (path) {
  var self = this;

  fs.readFile(path, function (err, data) {
    if (err) { throw err; }
    self.editor.text(data);
  });

  return self;
};

Program.prototype.exit = function () {
  process.exit(0);

  return this; // Just in case
};

Program.prototype.render = function (force) {
  this.screen.render();

  return this;
};

module.exports = Program;
