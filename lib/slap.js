var _ = require('lazy.js');
var blessed = require('blessed');
var path = require('path');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));

var Editor = require('./editor');
var Field = require('./field');
var Coordinate = require('./coordinate');
var markup = require('./markup');
var util = require('./util');
var textUtil = require('./textUtil');

function Slap (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new Slap(opts);

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

  self
    ._blink(true)
    ._initHandlers()
    .render();
}
Slap.prototype.__proto__ = blessed.Screen.prototype;

Slap.normalizePath = function (givenPath) {
  if (!givenPath) givenPath = '';
  if (givenPath[0] === '~') {
    givenPath = path.join(process.platform !== 'win32'
      ? process.env.HOME
      : process.env.USERPROFILE
    , givenPath.slice(1));
  }
  return path.normalize(givenPath);
};
Slap.prototype.path = util.getterSetter('path', null, Slap.normalizePath);
Slap.prototype.open = function (givenPath) {
  var self = this;
  givenPath = Slap.normalizePath(givenPath);
  self.path(givenPath);
  return fs.readFileAsync(givenPath)
    .then(function (data) { self.editor.text(data, givenPath.split('.').pop()); })
    .catch(function (err) {
      if (!err.cause || err.cause.code !== 'ENOENT') throw err;
      self.editor.changeStack.savePosition = null;
      self.render();
    });
};
Slap.prototype.save = function (givenPath) {
  var self = this;
  givenPath = givenPath ? Slap.normalizePath(givenPath) : self.path();
  if (!givenPath) return;

  var text = self.editor.text();
  return fs.writeFileAsync(givenPath, text, {flags: 'w'})
    .then(function () {
      self.editor.changeStack.save();
      self.emit('save', givenPath, text);
      return self.path(givenPath).message("saved to " + givenPath, 'success');
    })
    .catch(function (err) {
      switch (err.code) {
        case 'EACCES': case 'EISDIR':
          self.message(err.message, 'error');
          break;
        default: throw err;
      }
    });
};
Slap.prototype.saveAs = function () {
  var self = this;
  return self.prompt("save as").then(function (results) {
    if (results) return self.save(results[0]);
  });
};

Slap.prototype.prompt = function (prompts) {
  var self = this;

  return new Promise(function (resolve, reject) {
    prompts = typeof prompts !== 'string' ? prompts : [prompts];

    if (self.form) {
      self.remove(self.form);
      self.form = null;
      self.editor.focus();
      self.editor.bottom = 0;
    }
    if (prompts) {
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
        self.prompt(false).done();

        // FIXME: nasty hack to stop Enter key event propagating to the wrong element
        self.lockKeys = true;
        process.nextTick(function () {
          self.lockKeys = false;
          resolve(submit ? _(fields).invoke('text').toArray() : null);
        });
      }

      var fields = prompts.map(function (prompt, i) {
        var field = new Field(_(self.options.editor || {}).merge({
          parent: self.form,
          top: i,
          height: 1,
          left: labelWidth,
          right: 0
        }).merge(self.options.field || {}).toObject());
        if (!i) field.focus();
        field.on('submit', done.bind(null, true));
        field.on('cancel', done.bind(null, false));
        return field;
      });
    } else {
      resolve();
    }
    self.render();
  });
};

Slap.prototype.exit = function () {
  process.exit(0);

  return this; // Just in case
};

Slap.prototype._blink = util.getterSetter('blink', null, function (blink) {
  var self = this;
  clearTimeout(self.data.blinkTimer);
  if (self.options.blinkRate) {
    self.data.blinkTimer = setTimeout(function () {
      self._blink(!blink);
    }, self.options.blinkRate);
  }
  return blink;
});
Slap.prototype.message = util.getterSetter('message', null, function (message, styleName) {
  var self = this;

  clearTimeout(self.data.messageTimer);
  self.data.messageTimer = setTimeout(function () {
    self.message(null);
  }, self.options.messageDuration);

  self._blink(false);
  return message !== null ? markup.markupLine(' '+message+' ', self.options.style[styleName]) : null;
});

Slap._regExpRegExp = /^\/(.+)\/([im]?)$/;
Slap.prototype._initHandlers = function () {
  var self = this;

  var style = self.options.style;
  self.on('element keypress', function (el, ch, key) {
    if (key.name !== 'mouse') self.message(null);
    switch (util.getBinding(self.options.bindings, key)) {
      case 'quit':
        var newEmptyFile = self.editor.changeStack.savePosition === null && !self.editor.text();
        if (self.editor.changeStack.dirty() && !newEmptyFile) {
          self.prompt("save unsaved changes to (leave empty to quit)")
            .then(function (results) {
              if (results && results[0]) return self.save(results[0]);
            })
            .done(function () { self.exit(); });
        } else {
          self.exit();
        }
        break;
      case 'find':
        self.prompt("find (/.*/ for regex)").done(function (results) {
          if (!results) return;
          var pattern = results[0];
          if (!pattern) return;

          var regExpMatch = pattern.match(Slap._regExpRegExp);
          pattern = regExpMatch
            ? new RegExp(regExpMatch[1], regExpMatch[2])
            : new RegExp(textUtil.escapeRegExp(pattern), 'im');

          var startPos = self.editor.cursor();
          startPos.x += 1;
          var pos = self.editor.find(pattern, startPos);

          if (pos) {
            self.editor.select(pos);
          } else {
            pos = self.editor.find(pattern);
            if (pos) {
              self.message(Coordinate.linear.cmp(pos.end, self.editor.cursor()) !== 0
                ? "search wrapped"
                : "this is the only occurrence", 'info');
              self.editor.select(pos);
            } else {
              self.message("no matches", 'warning');
            }
          }
        });
        break;
      case 'goLine':
        self.prompt("line number").done(function (results) {
          if (!results) return;
          var lineNumber = parseInt(results[0]);
          if (!lineNumber) return;

          self.editor.select(null, {x: 0, y: lineNumber - 1});
        });
      case 'save':
        (self.path()
          ? self.save()
          : self.saveAs()).done();
        break;
      case 'saveAs':
        self.saveAs().done();
        break;
    }
  });

  self.on('element blur', function (el) {
    if (function nodeContains (element) {
      return element === el || (element ? element.children : []).some(nodeContains);
    }(self.form)) {
      self.prompt(false).done();
    }
  });

  ['resize', 'save', 'path', 'message', 'blink'].forEach(function (evt) {
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
  var markupPath = markup.escapeCurlies(originalPath
    ? path.relative(process.cwd(), originalPath)
    : 'new file');
  if (self.editor.changeStack.dirty() || !originalPath) {
    markupPath = markup.markupLine(markupPath+'*', style.changed);
  }
  left += markupPath;

  var right = [(cursor.y+1)+','+(cursor.x+1) + ' ('+self.editor.lines().length+')'];
  if (!self.editor.insertMode()) right.unshift(markup.markupLine('OVR', '{red-bg}{white-fg}'));
  var message = self.message();
  if (message) {
    if (self._blink()) message = markup.markupLine(message, style.blink);
    right.unshift(message);
  }
  right = right.join('  ') + ' ';

  var remainingWidth = self.header.width - self.header.iwidth - markup.removeMarkup(left + right).length;
  self.header.setContent(markup.markupLine(
    left + _.repeat(' ', remainingWidth).join('') + right
  , style.header || style.main));

  return blessed.Screen.prototype.render.apply(self, arguments);
};

module.exports = Slap;
