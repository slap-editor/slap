var _ = require('lazy.js');
var blessed = require('blessed');
var path = require('path');

var Slap = require('./Slap');
var BaseElement = require('./BaseElement');
var Button = require('./Button');

var util = require('../util');
var markup = require('../markup');

function Header (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new Header(opts);

  BaseElement.call(self, _({
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      padding: {left: 1, right: 1}
    })
    .merge(Slap.global.options.header || {})
    .merge({tags: true})
    .merge(opts || {})
    .toObject());

  var helpBinding = self.slap.options.bindings.help;
  helpBinding = Array.isArray(helpBinding) ? helpBinding[0] : helpBinding;
  self.helpButton = new Button(_({
      parent: self,
      content: "Help" + (helpBinding ? ": " + helpBinding : ""),
      top: 0,
      right: self.padding.right
    })
    .merge(self.options.helpButton || {})
    .toObject());

  self.leftContent = new BaseElement(_({
      parent: self,
      tags: true,
      left: self.padding.left,
      shrink: true,
      style: self.options.style
    })
    .merge(self.options.leftContent || {})
    .toObject());

  self.rightContent = new BaseElement(_({
      parent: self,
      tags: true,
      right: self.padding.right + BaseElement.prototype.shrinkWidth.call(self.helpButton) + 1,
      shrink: true,
      style: self.options.style
    })
    .merge(self.options.rightContent || {})
    .toObject());

  self._blink(true);
}
Header.prototype.__proto__ = BaseElement.prototype;

Header.prototype._blink = util.getterSetter('blink', null, function (blink) {
  var self = this;
  clearTimeout(self.data.blinkTimer);
  if (self.options.blinkRate) {
    self.data.blinkTimer = setTimeout(function () {
      self._blink(!blink);
    }, self.options.blinkRate);
  }
  return blink;
});
Header.prototype.message = util.getterSetter('message', null, function (message, styleName) {
  var self = this;

  clearTimeout(self.data.messageTimer);
  if (message) {
    self.data.messageTimer = setTimeout(function () {
      self.message(null);
    }, self.options.messageDuration);
  }

  self._blink(false);
  return message !== null ? markup(' '+message+' ', self.options.style[styleName || 'info']) : null;
});

Header.prototype._initHandlers = function () {
  var self = this;
  ['message', 'blink'].forEach(function (evt) {
    self.on(evt, function () { self.parent.render(); });
  });
  self.helpButton.on('press', function () { self.slap.help(); });
  return BaseElement.prototype._initHandlers.apply(self, arguments);
};

Header.prototype.render = function () {
  var self = this;

  var style = self.options.style;
  var slap = self.slap;
  var editor = (slap.panes[slap.data.currentPane] || {}).editor;
  if (editor) {
    var cursor = editor.cursor();

    var originalPath = editor.path();
    var markupPath = originalPath
      ? blessed.escape(path.relative(self.slap.fileBrowser.cwd, originalPath))
      : "new file";
    if (editor.changeStack.dirty() || !originalPath) {
      markupPath = markup(markupPath+"*", style.changed);
    }
    self.leftContent.setContent('\u270b ' + markupPath);

    var originalEncoding = editor.encoding();
    var markupEncoding = originalEncoding ? blessed.escape(originalEncoding) : '';
    var right = [(cursor.y+1)+","+(cursor.x+1) + " ("+editor.lines().length+")", markupEncoding];

    if (editor.readOnly()) right.push(markup("read-only", style.warning));

    if (!slap.insertMode()) right.unshift(markup("OVR", style.overwrite));
    var message = self.message();
    if (message) {
      if (self._blink()) message = markup(message, style.blink);
      right.unshift(message);
    }
    self.rightContent.setContent(right.join(" "));
  } else {
    self.leftContent.setContent("\u270b");
    self.rightContent.setContent('');
  }

  return BaseElement.prototype.render.apply(self, arguments);
};

module.exports = Header;
