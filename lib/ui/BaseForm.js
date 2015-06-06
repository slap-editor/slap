var blessed = require('blessed');
var _ = require('lazy.js');

var util = require('slap-util');

var BaseWidget = require('base-widget');
var Slap = require('./Slap');

function BaseForm (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new BaseForm(opts);

  BaseWidget.call(self, _({
      hidden: true,
      height: 1,
      left: 0,
      right: 0,
      bottom: 0
    })
    .merge(Slap.global.options.form || {})
    .merge(opts || {})
    .toObject());
  if (self.parent instanceof Pane) self.pane.forms.push(self);
}
BaseForm.prototype.__proto__ = BaseWidget.prototype;

BaseForm.prototype.cancel = function () { this.emit('cancel'); };
BaseForm.prototype.submit = function () { this.emit('submit'); };
BaseForm.prototype._initHandlers = function () {
  var self = this;
  self.on('element keypress', function (el, ch, key) {
    switch (util.getBinding(self.options.bindings, key)) {
      case 'cancel': self.cancel(); return false;
    };
  });
  self.on('show', function () { self.focus(); });
  self.on('hide', function () {
    self.slap._stopKeyPropagation().done();
    if (self.screen.focused.hasAncestor(self.pane) && !self.screen.focused.visible) self.pane.focus();
  });
  self.on('element blur', function (el) { if (self.visible && !self.hasFocus(true)) self.cancel(); });
  self.on('element submit', function (el) { if (el !== self) self.submit(); });
  self.on('element cancel', function (el) { if (el !== self) self.cancel(); });
  self.on('cancel', function () { self.hide(); });

  return BaseWidget.prototype._initHandlers.apply(self, arguments);
};

module.exports = BaseForm;

var Pane = require('./Pane'); // circular import
