var blessed = require('blessed');
var _ = require('lazy.js');

var Slap = require('./Slap');
var Editor = require('./Editor');
var BaseForm = require('./BaseForm');

var util = require('../util');
var textUtil = require('../textUtil');

function Field (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new Field(opts);

  Editor.call(self, _({
      height: 1,
      multiLine: false
    })
    .merge(Slap.global.options.field || {})
    .merge(opts || {})
    .toObject());
  if (self.parent instanceof BaseForm) self.form = self.parent;
  self.language(false);
}
Field.prototype.__proto__ = Editor.prototype;

Field.prototype.submit = function (value) { this.emit('submit', value); }
Field.prototype.cancel = function () { this.emit('cancel'); }
Field.prototype._initHandlers = function () {
  var self = this;
  self.on('keypress', function (ch, key) {
    switch (util.getBinding(self.options.bindings, key)) {
      case 'submit': self.submit(self.textBuf.getText()); return false;
      case 'cancel': self.cancel(); return false;
    };
  });
  return Editor.prototype._initHandlers.apply(self, arguments);
}

module.exports = Field;
