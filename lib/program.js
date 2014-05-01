var _ = require('lazy.js');
var blessed = require('blessed');
var extend = require('xtend');
var fs = require('fs');

var Editor = require('./editor');
var markup = require('./markup');

function Program (opts) {
  var self = this;

  self.opts = opts;

  self.screen = blessed.screen();

  self.header = new blessed.Box(extend({
    tags: true,
    top: 0,
    left: 0,
    right: 0,
    height: 1
  }, opts.header));
  self.screen.append(self.header);

  self.editor = new Editor(extend({
    top: 1,
    left: 0,
    right: 0,
    bottom: 1
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
    if (self.editor.changeStack.dirty()) {
      self.exit(); // FIXME: warn user focused element needs finishing
    } else {
      self.exit();
    }
  });

  self.screen.on('resize', function () {
    self.render();
  });

  ['change', 'cursor', 'insertMode'].forEach(function (evt) {
    self.editor.on(evt, function () {
      self.render();
    });
  });

  return self;
};

Program.prototype.open = function (path) {
  var self = this;

  fs.readFile(path, function (err, data) {
    if (err) { throw err; }
    self.filename = path;

    self.editor
      .language(path.split('.').pop())
      .text(data, true);

    self.render();
  });

  return self;
};

Program.prototype.exit = function () {
  process.exit(0);

  return this; // Just in case
};

Program.prototype.render = function () {
  var self = this;

  var cursor = self.editor.cursor();

  var left = ' \u270b ' +
    markup.escapeCurlies(self.filename || 'new file') +
    (self.editor.changeStack.dirty() ? '*' : '');

  var right = ['row: ' + cursor.y, 'col: ' + cursor.x];
  if (!self.editor.insertMode()) { right.unshift('{red-bg}{white-fg}ovr{/white-fg}{/red-bg}'); }
  right = right.join('  ') + ' ';

  var remainingWidth = self.header.width - self.header.iwidth - markup.removeMarkup(left + right).length;
  self.header.setContent(markup.markupLine(
    left + _.repeat(' ', remainingWidth).join('') + right
  , self.header.options.style));

  self.screen.render();

  return self;
};

module.exports = Program;
