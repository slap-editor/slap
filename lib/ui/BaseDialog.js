var blessed = require('blessed');
var _ = require('lazy.js');

var Slap = require('./Slap');
var BaseElement = require('./BaseElement');

var util = require('../util');

function BaseDialog (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new BaseDialog(opts);

  BaseElement.call(self, _({
      shrink: true,
      hidden: true,
      tags: true,
      top: 'center',
      left: 'center',
      padding: {top: 1, left: 1, right: 1, bottom: 3}
    })
    .merge(Slap.global.options.dialog || {})
    .merge(opts || {})
    .toObject());

  self.otherDialogs = _(self.slap.children)
    .filter(function (child) { return child instanceof BaseDialog; })
    .without(self);
}
BaseDialog.prototype.__proto__ = BaseElement.prototype;

BaseDialog.prototype._initHandlers = function () {
  var self = this;
  self.on('show', function () {
    self.screen.program.hideCursor();
    self.otherDialogs.invoke('hide');
    process.nextTick(function () { self.screen.render(); });
  });

  self.on('element press', function () { self.hide(); });
  self.on('element blur', function () { if (!self.hasFocus()) self.hide(); });
  self.on('hide', function () {
    if (self.otherDialogs.pluck('visible').compact().none()) {
      self.slap._stopKeyPropagation();
      var pane = self.slap.currentPane();
      if (pane) {
        pane.focus();
        process.nextTick(function () { self.screen.render(); });
      }
    }
  });

  return BaseElement.prototype._initHandlers.apply(self, arguments);
};

module.exports = BaseDialog;
