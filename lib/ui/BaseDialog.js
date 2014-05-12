var blessed = require('blessed');
var _ = require('lazy.js');

var BaseModal = require('./BaseModal');
var util = require('../util');

function BaseDialog (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new BaseDialog(opts);

  BaseModal.call(self, _({
    top: 'center',
    left: 'center',
    padding: {top: 1, left: 1, right: 1, bottom: 3},
    shrink: true
  }).merge(opts || {}).toObject());

  self.on('show', function () { self.screen.program.hideCursor(); });
  self.on('element press', function () { self.hide(); });
}
BaseDialog.prototype.__proto__ = BaseModal.prototype;

module.exports = BaseDialog;
