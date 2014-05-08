var blessed = require('blessed');
var _ = require('lazy.js');

var BaseModal = require('./BaseModal');

function BaseForm (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new BaseForm(opts);

  BaseModal.call(self, _({
    height: 1,
    left: 0,
    right: 0,
    bottom: 0,
    hidden: true
  }).merge(opts || {}).toObject());
  self.otherForms = self.otherModals.filter(function (child) { return child instanceof BaseForm; });

  self.on('show', function () {
    self.parent.editor.bottom = self.height;
  });
  self.on('hide', function () {
    self.parent.header.message(null);
    if (self.otherForms.pluck('visible').compact().none()) {
      self.parent.editor.bottom = 0;
    }
  });
  self.on('element submit', function (el) { if (el !== self) self.submit(); });
  self.on('element cancel', function (el) { if (el !== self) self.cancel(); });
  self.on('submit', function () { self.hide(); });
  self.on('cancel', function () { self.hide(); });
}
BaseForm.prototype.__proto__ = BaseModal.prototype;

BaseForm.prototype.submit = function () { this.emit('submit'); };

module.exports = BaseForm;
