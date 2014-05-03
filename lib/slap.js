var _ = require('lazy.js');
var blessed = require('blessed');
var fs = require('fs');
var path = require('path');

var Editor = require('./editor');
var Coordinate = require('./coordinate');
var markup = require('./markup');
var util = require('./util');
var textUtil = require('./textUtil');

function Slap (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) { return new Slap(opts); }

  blessed.Screen.call(self, opts);

  self.header = new blessed.Box(_({
    tags: true,
    top: 0,
    left: 0,
    right: 0,
    height: 1
  }).merge(opts.header || {}).merge({parent: self}).toObject());

  self.editor = new Editor(_({
    parent: self,
    top: 1,
    left: 0,
    right: 0,
    bottom: 0
  }).merge(opts.editor || {}).toObject());
  self.editor.focus();

  self._initHandlers().render();
}
Slap.prototype.__proto__ = blessed.Screen.prototype;

Slap.normalizePath = function (givenPath) {
  if (!givenPath) { givenPath = ''; }
  if (givenPath[0] === '~') { givenPath = path.join(process.env.HOME, givenPath.slice(1)); }
  return path.normalize(givenPath);
};
Slap.prototype.path = util.getterSetter('path', null, Slap.normalizePath);
Slap.prototype.open = function (givenPath) {
  var self = this;

  givenPath = Slap.normalizePath(givenPath);
  fs.readFile(givenPath, function (err, data) {
    if (err) { throw err; }
    self.path(givenPath);

    self.editor.text(data, givenPath.split('.').pop());
  });

  return self;
};
Slap.prototype.save = function (givenPath) {
  var self = this;
  givenPath = givenPath ? Slap.normalizePath(givenPath) : self.path();
  if (!givenPath) { return; }

  var text = self.editor.text();
  fs.writeFile(givenPath, text, {flags: 'w'}, function (err) {
    if (!err) {
      self
        .path(givenPath)
        .message("saved to " + givenPath, 'success');
      self.editor.changeStack.save();
      self.emit('save', givenPath, text);
    } else {
      switch (err.code) {
        case 'EACCES': case 'EISDIR':
          self.message(err.message, 'error');
          break;
        default: throw err;
      }
    }
  });
};
Slap.prototype.saveAs = function () {
  var self = this;
  self.prompt("save as", function (results) {
    if (results) {
      self.save(results[0]);
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
    self.closePrompt(true);
    cb(submit ? _(inputs).pluck('value').toArray() : null);

    // FIXME: nasty hack to stop Enter key event propagating to the wrong element
    self.lockKeys = true;
    process.nextTick(function () { self.lockKeys = false; });
  }

  var inputs = prompts.map(function (prompt, i) {
    var input = new blessed.Textbox(_(self.options.editor || {}).merge({
      parent: self.form,
      inputOnFocus: true,
      top: i,
      height: 1,
      left: labelWidth,
      right: 0
    }).merge(self.options.input || {}).toObject());
    if (!i) { input.focus(); }
    input.on('submit', done.bind(null, true));
    input.on('cancel', done.bind(null, false));
    return input;
  });

  self.render();
  return self;
};

Slap.prototype.closePrompt = function (focus) {
  var self = this;

  if (self.form) {
    self.remove(self.form);
    self.form = null;
    if (focus) { self.editor.focus(); }
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
              self.editor.select(null, pos);
            } else {
              pos = textUtil.find(self.editor.lines(), pattern);
              if (pos) {
                if (Coordinate.linear.cmp(pos, self.editor.cursor()) === 0) {
                  self.message("this is the only occurrence", 'info');
                }
                self.editor.select(null, pos);
              } else {
                self.message("no matches", 'warning');
              }
            }
          }
        });
        break;
      case 'save':
        if (self.path()) { self.save(); }
        else { self.saveAs(); }
        break;
      case 'saveAs':
        self.saveAs();
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
  var markupPath = markup.escapeCurlies(originalPath || 'new file');
  if (self.editor.changeStack.dirty() || !originalPath) {
    markupPath = markup.markupLine(markupPath+'*', style.changed);
  }
  left += markupPath;

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
