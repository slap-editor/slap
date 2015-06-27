var _ = require('lodash');
var blessed = require('blessed');
var path = require('path');

var util = require('slap-util');

var BaseWidget = require('base-widget');
var Slap = require('./Slap');
var Button = require('./Button');

function Header (opts) {
  var self = this;

  if (!(self instanceof Header)) return new Header(opts);

  BaseWidget.call(self, _.merge(opts.headerPosition !== 'bottom'
    ? {top: 0}
    : {bottom: 0}, {
    left: 0,
    right: 0,
    height: 1
  }, Slap.global.options.header, opts));

  self.leftContent = new BaseWidget(_.merge({
    parent: self,
    tags: true,
    left: 1,
    shrink: true,
    style: self.options.style
  }, self.options.leftContent));

  var helpBinding = Slap.global.options.bindings.help;
  helpBinding = Array.isArray(helpBinding) ? helpBinding[0] : helpBinding;
  self.helpButton = new Button(_.merge({
    parent: self,
    content: "Help" + (helpBinding ? ": " + helpBinding : "")
  }, self.options.helpButton));

  self.rightContent = new BaseWidget(_.merge({
    parent: self,
    tags: true,
    shrink: true,
    style: self.options.style
  }, self.options.rightContent));

  self.messageContent = new BaseWidget(_.merge({
    parent: self,
    tags: true,
    shrink: true,
    style: self.options.style
  }, self.options.messageContent));

  // self._blink(true);
}
Header.prototype.__proto__ = BaseWidget.prototype;

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

  // self._blink(false);
  return message !== null ? util.markup(' '+message+' ', self.options.style[styleName || 'info']) : null;
});

Header.prototype._initHandlers = function () {
  var self = this;
  ['message', 'blink'].forEach(function (evt) {
    self.on(evt, function () { self.screen.render(); });
  });
  self.helpButton.on('press', function () { self.screen.slap.help(); });
  return BaseWidget.prototype._initHandlers.apply(self, arguments);
};

Header.prototype.render = function () {
  var self = this;


  var left = ["\u270b"];
  var right = [];

  var style = self.options.style;
  var slap = self.screen.slap;
  var editor = (slap.panes[slap.data.currentPane] || {}).editor;
  if (editor) {
    var originalPath = editor.textBuf.getPath();
    var markupPath = originalPath
      ? blessed.escape(path.relative(slap.fileBrowser.cwd, originalPath))
      : "new file";
    if (editor.textBuf.isModified()) {
      markupPath = util.markup(markupPath+"*", style.changed);
    }
    left.push(markupPath);

    var cursor = editor.selection.getHeadPosition();
    var originalEncoding = editor.textBuf.getEncoding();
    right = [
      [cursor.row+1, cursor.column+1].join(","),
      "("+editor.textBuf.getLineCount()+")"
    ];
    if (originalEncoding) right.push(blessed.escape(originalEncoding));
    if (editor.readOnly()) right.push(util.markup("read-only", style.warning));
    if (!editor.insertMode()) right.unshift(util.markup("OVR", style.overwrite));
  }

  self.leftContent.setContent(left.join(" "));
  self.rightContent.setContent(right.join(" "));

  var message = self.message() || "";
  if (self._blink()) message = util.markup(message, style.blinkStyle);
  self.messageContent.setContent(message.toString());

  // float: right basically
  ['helpButton', 'rightContent', 'messageContent'].reduce(function (right, key) {
    self[key].right = right;
    return 2 + right + BaseWidget.prototype.shrinkWidth.call(self[key]);
  }, 1);

  return BaseWidget.prototype.render.apply(self, arguments);
};

module.exports = Header;
