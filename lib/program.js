var _ = require('lazy.js');
var blessed = require('blessed');
var extend = require('xtend');
var fs = require('fs');

var Editor = require('./editor');
var markup = require('./markup');
var util = require('./util');

function Program (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) { return new Program(opts); }

  blessed.Box.call(self, extend({parent: blessed.screen()}, opts));

  self.header = new blessed.Box(extend({
    parent: self,
    tags: true,
    top: 0,
    left: 0,
    right: 0,
    height: 1
  }, opts.header));

  self.editor = new Editor(extend({
    parent: self,
    top: 1,
    left: 0,
    right: 0,
    bottom: 0
  }, opts.editor));
  self.editor.focus();

  self.parent.program.showCursor();

  self
    ._initHandlers()
    ._programRender();
}
Program.prototype.__proto__ = blessed.Box.prototype;

Program._regExpRegExp = /^\/(.+)\/$/g;
Program.prototype._initHandlers = function () {
  var self = this;

  self.parent.key(['escape', 'C-q'], function () {
    if (self.editor.changeStack.dirty()) {
      self.exit(); // FIXME: warn user focused element needs finishing
    } else {
      self.exit();
    }
  });

  self.parent.key('C-f', function () {
    self.prompt("find", function (results) {
      if (results) {
        pattern = results[0];
        var regExpMatch = Program._regExpRegExp.exec(pattern);
        pattern = regExpMatch
          ? new RegExp(regExpMatch[1])
          : new RegExp(util.escapeRegExp(pattern));

        var pos = self.editor.find(pattern, self.editor.cursor());

        if (pos) {
          self.editor.cursor(pos);
        } else {
          pos = self.editor.find(pattern);
          if (pos) {
            self.editor.cursor(pos);
          } else {
            self.message(markup.markupLine("no matches"));
          }
        }
      }
    });
  });

  ['resize', 'message'].forEach(function (evt) {
    self.on(evt, function () { self._programRender(); });
  });

  ['change', 'cursor', 'insertMode'].forEach(function (evt) {
    self.editor.on(evt, function () { self._programRender(); });
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

    self._programRender();
  });

  return self;
};

Program.prototype.prompt = function (prompts, cb) {
  var self = this;

  prompts = typeof prompts !== 'string' ? prompts : [prompts];

  self.closePrompt();
  self.editor.bottom += prompts.length;
  self.form = new blessed.Form({
    parent: self,
    height: prompts.length,
    left: 0,
    right: 0,
    bottom: 0
  });

  var labelWidth = _(prompts).pluck('length').max() + 3;
  var label = new blessed.Box({
    parent: self.form,
    tags: true,
    content: prompts.map(function (prompt) {
      return markup.markupLine(
        (' ' + prompt + ':' + _.repeat(' ', labelWidth).join('')).slice(0, labelWidth),
      '{white-bg}{black-fg}');
    }).join('\n'),
    top: 0,
    left: 0,
    width: labelWidth,
    bottom: 0
  });

  function done (submit) {
    self.closePrompt();
    cb(submit ? _(inputs).pluck('value').toArray() : null);
  }

  var inputs = prompts.map(function (prompt, i) {
    var input = new blessed.Textbox({
      parent: self.form,
      inputOnFocus: true,
      top: i,
      height: 1,
      left: labelWidth,
      right: 0
    });
    if (!i) { input.focus(); }
    input.on('submit', done.bind(null, true));
    input.on('cancel', done.bind(null, false));
    return input;
  });

  return self._programRender();
};

Program.prototype.closePrompt = function () {
  var self = this;

  if (self.form) {
    self.remove(self.form);
    self.form = null;
    self.editor.focus();
    self.editor.bottom = 0;
    self._programRender();
  }

  return self;
};

Program.prototype.exit = function () {
  process.exit(0);

  return this; // Just in case
};

Program.prototype.message = util.getterSetter('message', null, function (message) {
  var self = this;

  if (message !== null) {
    setTimeout(function () {
      self.message(null);
    }, self.options.messageDuration);
  }

  return message;
});

Program.prototype._programRender = function () {
  var self = this;

  var cursor = self.editor.cursor();

  var left = ' \u270b ' +
    markup.escapeCurlies(self.filename || 'new file') +
    (self.editor.changeStack.dirty() ? '*' : '');

  var right = [(cursor.y + 1)+','+(cursor.x + 1) + ' ('+self.editor.lines().length+')'];
  if (!self.editor.insertMode()) { right.unshift(markup.markupLine('ovr', '{red-bg}{white-fg}')); }
  var message = self.message();
  if (message) { right.unshift(message); }
  right = right.join('  ') + ' ';

  var remainingWidth = self.header.width - self.header.iwidth - markup.removeMarkup(left + right).length;
  self.header.setContent(markup.markupLine(
    left + _.repeat(' ', remainingWidth).join('') + right
  , self.header.options.style));

  self.editor._editorRender();
  self.parent.render();

  return self;
};

module.exports = Program;
