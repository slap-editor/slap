var _ = require('lazy.js');
var blessed = require('blessed');

var util = require('../util');
var markup = require('../markup');

function Header (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new Header(opts);

  blessed.Box.call(self, _({
    top: 0,
    left: 0,
    right: 0,
    height: 1
  }).merge(opts).toObject());
  delete opts.parent;

  self.rightContent = new blessed.Box(_({
    parent: self,
    tags: true,
    top: 0,
    right: 1,
    height: 1,
    shrink: true
  }).merge(opts).toObject());

  self.leftContent = new blessed.Box(_({
    parent: self,
    tags: true,
    top: 0,
    left: 1,
    height: 1,
    shrink: true
  }).merge(opts).toObject());
  // append leftContent after rightContent so leftContent goes over if too thin

  self._blink(true);
  ['message', 'blink'].forEach(function (evt) {
    self.on(evt, function () { self.parent.render(); });
  });
}
Header.prototype.__proto__ = blessed.Box.prototype;

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
  return message !== null ? markup(' '+message+' ', self.options.style[styleName]) : null;
});

Header.prototype.render = function () {
  var self = this;

  var style = self.options.style;
  var editor = self.parent.editor;
  var cursor = editor.cursor();

  var originalPath = self.parent.path();
  var markupPath = originalPath ? blessed.escape(originalPath) : 'new file';
  if (editor.changeStack.dirty() || !originalPath) {
    markupPath = markup(markupPath+'*', style.changed);
  }
  self.leftContent.setContent('\u270b ' + markupPath);

  var right = [(cursor.y+1)+','+(cursor.x+1) + ' ('+editor.lines().length+')'];
  if (!self.parent.insertMode()) right.unshift(markup('OVR', style.overwrite));
  var message = self.message();
  if (message) {
    if (self._blink()) message = markup(message, style.blink);
    right.unshift(message);
  }
  self.rightContent.setContent(right.join('  '));

  return blessed.Box.prototype.render.apply(self, arguments);
};

module.exports = Header;
