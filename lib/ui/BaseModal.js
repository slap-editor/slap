var blessed = require('blessed');
var _ = require('lazy.js');

var util = require('../util');

function BaseModal (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new BaseModal(opts);

  blessed.Box.call(self, _({hidden: true}).merge(opts || {}).toObject());
  self.otherModals = _(self.parent.children)
    .filter(function (child) { return child instanceof BaseModal; })
    .without(self);

  self.on('element blur', function () {
    if (!self.screen.focused.hasAncestor(self) && self.screen.focused !== self) self.hide();
  });

  self.on('click', function () {
    process.nextTick(function () {
      // TODO: don't change focus if contained element has focus already
      var firstChild = self.children[0];
      if (firstChild) firstChild.focus();
    });
  });

  self.on('keypress', _.noop); // 'element keypress' doesn't work correctly without this
  self.on('element keypress', function (el, ch, key) {
    switch (util.getBinding(self.options.bindings, key)) {
      case 'hide': self.hide(); break;
      case 'focusNext': self.focusEl(1); break;
      case 'focusPrev': self.focusEl(-1); break;
    }
  });
  self.on('show', function () {
    self.otherModals.invoke('hide');
    // if (self.otherModals.pluck('visible').compact().none()) self.screen.saveFocus();
    process.nextTick(function () { self.parent.render(); });
  });
  self.on('hide', function () {
    if (self.otherModals.pluck('visible').compact().none()) {
      self.parent.lockKeys = true; process.nextTick(function () { self.parent.lockKeys = false; }); // FIXME: ugly hack to stop enter from last event from propagating to editor

      // self.screen.restoreFocus();
      self.parent.editor.focus();
      process.nextTick(function () { self.parent.render(); });
    }
  });
}
BaseModal.prototype.__proto__ = blessed.Box.prototype;
BaseModal.prototype.focusEl = function (direction) {
  var self = this;
  var index = self.children.indexOf(self.screen.focused);
  if (index !== -1) {
    index += direction;
    if (index === -1) index = self.children.length - 1;
    if (index === self.children.length) index = 0;
  } else {
    index = 0;
  }
  if (self.children[index]) self.children[index].focus();
  return self;
};

module.exports = BaseModal;
