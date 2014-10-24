var _ = require('lazy.js');
var blessed = require('blessed');

var util = require('../util');
var markup = require('../markup');

function Header (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new Header(opts);

  // Define the header options object
  var headerOptions = {
    left: 0,
    right: 0,
    height: 1,
    padding: {left: 1, right: 1}
  };

  // If option headerPosition is not set, or is set to top; position header at the top.
  if(opts.headerPosition === undefined || opts.headerPosition === 'top') {
    // Variable headerPositon specifies which position the header is in.
    self.headerPosition = 'top';
    headerOptions.top = 0;
  // Else if option headerPosition is set to bottom; position header at the bottom.
  } else {
    self.headerPosition = 'bottom';
    headerOptions.bottom = 0;
  }

  blessed.Box.call(self, _(headerOptions).merge(opts).toObject());
  delete opts.parent;

  var helpBinding = self.parent.options.bindings.help;
  helpBinding = Array.isArray(helpBinding) ? helpBinding[0] : helpBinding;

  self.helpButton = new blessed.Button({
    parent: self,
    content: "Help" + (helpBinding ? ": " + helpBinding : ""),
    mouse: true,
    shrink: true,
    padding: {left: 1, right: 1},
    right: self.padding.right,
    style: {focus: {bg: 'blue'}, hover: {bg: 'blue'}}
  });

  self.rightContent = new blessed.Box(_({
    parent: self,
    tags: true,
    right: self.padding.right + util.shrinkWidth(self.helpButton) + 1,
    shrink: true
  }).merge(opts).toObject());

  self.leftContent = new blessed.Box(_({
    parent: self,
    tags: true,
    left: self.padding.left,
    shrink: true
  }).merge(opts).toObject());
  // append leftContent after rightContent so leftContent goes over if too thin

  self._blink(true);
  ['message', 'blink'].forEach(function (evt) {
    self.on(evt, function () { self.parent.render(); });
  });
  self.helpButton.on('click', function () {
    self.parent.helpDialog.show();
  })
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
