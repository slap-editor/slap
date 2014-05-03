var _ = require('lazy.js');
var blessed = require('blessed');
var extend = require('xtend');
var fs = require('fs');

var Editor = require('./editor');
var Coordinate = require('./coordinate');
var markup = require('./markup');
var util = require('./util');
var textUtil = require('./textUtil');

function Slap (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) { return new Slap(opts); }

  blessed.Screen.call(self, extend({}, opts));

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

  self._initHandlers().render();
}
Slap.prototype.__proto__ = blessed.Screen.prototype;

Slap.prototype.path = util.getterSetter('path');
Slap.prototype.open = function (path) {
  var self = this;

  fs.readFile(path, function (err, data) {
    if (err) { throw err; }
    self.path(path);

    self.editor.text(data, path.split('.').pop());
  });

  return self;
};
Slap.prototype.save = function (path) {
  var self = this;
  path = path || self.path();
  if (!path) { return; }

  var text = self.editor.text();
  fs.writeFile(path, text, function (err) {
    if (!err) {
      self.path(path);
      self.editor.changeStack.save();
      self.emit('save', path, text);
    } else {
      if (err.code === 'EACCES') { self.message(err.message, 'error'); }
      else { throw err; }
    }
  });
};

Slap.prototype.prompt = function (prompts, cb) {
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
      self.options.style.prompt || self.options.style.main);
    }).join('\n'),
    top: 0,
    left: 0,
    width: labelWidth,
    bottom: 0
  });

  function done (submit) {
    self.closePrompt();
    cb(submit ? _(inputs).pluck('value').toArray() : null);

    // FIXME: nasty hack to stop Enter key event propagating to the wrong element
    self.lockKeys = true;
    process.nextTick(function () { self.lockKeys = false; });
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

  self.render();
  return self;
};

Slap.prototype.closePrompt = function () {
  var self = this;

  if (self.form) {
    self.remove(self.form);
    self.form = null;
    self.editor.focus();
    self.editor.bottom = 0;
    self.render();
  }

  return self;
};

Slap.prototype.exit = function () {
  process.exit(0);

  return this; // Just in case
};

Slap.prototype.message = util.getterSetter('message', null, function (message, styleName) {
  var self = this;

  if (message !== null) {
    setTimeout(function () {
      self.message(null);
    }, self.options.messageDuration);
  }

  return message !== null ? markup.markupLine(message, self.options.style[styleName]) : null;
});

Slap._regExpRegExp = /^\/(.+)\/$/;
Slap.prototype._initHandlers = function () {
  var self = this;

  var style = self.options.style;
  self.on('element keypress', function (el, ch, key) {
    switch (util.getBinding(self.options.bindings, key)) {
      case 'quit':
        if (self.editor.changeStack.dirty()) {
          self.exit(); // FIXME: warn user focused element needs finishing
        } else {
          self.exit();
        }
        break;
      case 'find':
        self.prompt("find (/.*/ for regex)", function (results) {
          if (results) {
            pattern = results[0];
            var regExpMatch = pattern.match(Slap._regExpRegExp);
            pattern = regExpMatch
              ? new RegExp(regExpMatch[1])
              : new RegExp(textUtil.escapeRegExp(pattern));

            var startPos = self.editor.cursor();
            startPos.x += 1;
            var pos = textUtil.find(self.editor.lines(), pattern, startPos);

            if (pos) {
              self.editor.cursor(pos);
            } else {
              pos = textUtil.find(self.editor.lines(), pattern);
              if (pos) {
                if (Coordinate.linear.cmp(pos, self.editor.cursor()) === 0) {
                  self.message("this is the only occurrence", 'info');
                }
                self.editor.cursor(pos);
              } else {
                self.message("no matches", 'warning');
              }
            }
          }
        });
        break;
      case 'save':
        if (self.path()) { self.save(); }
        else {
          self.prompt("save as", function (results) {
            if (results) {
              self.save(results[0]);
            }
          });
        }
        break;
    }
  });

  ['resize', 'message', 'save'].forEach(function (evt) {
    self.on(evt, function () { self.render(); });
  });

  ['change', 'cursor', 'insertMode'].forEach(function (evt) {
    self.editor.on(evt, function () { self.render(); });
  });

  return self;
};
Slap.prototype.render = function () {
  var self = this;

  var style = self.options.style;
  var cursor = self.editor.cursor();

  var left = ' \u270b ';
  var originalPath = self.path();
  var path = markup.escapeCurlies(originalPath || 'new file');
  if (self.editor.changeStack.dirty() || !originalPath) {
    path = markup.markupLine(path+'*', style.changed);
  }
  left += path;

  var right = [(cursor.y + 1)+','+(cursor.x + 1) + ' ('+self.editor.lines().length+')'];
  if (!self.editor.insertMode()) { right.unshift(markup.markupLine('ovr', '{red-bg}{white-fg}')); }
  var message = self.message();
  if (message) { right.unshift(message); }
  right = right.join('  ') + ' ';

  var remainingWidth = self.header.width - self.header.iwidth - markup.removeMarkup(left + right).length;
  self.header.setContent(markup.markupLine(
    left + _.repeat(' ', remainingWidth).join('') + right
  , style.header || style.main));

  return blessed.Screen.prototype.render.apply(self, arguments);
};

module.exports = Slap;
