var blessed = require('blessed');
var _ = require('lazy.js');

var Editor = require('./Editor');

var util = require('../util');
var textUtil = require('../textUtil');

function Field (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new Field(opts);

  Editor.call(self, _({height: 1, multiLine: false}).merge(opts || {}).toObject());
  self.language(false);
  self.on('keypress', function (ch, key) {
    switch (util.getBinding(self.options.bindings, key)) {
      case 'submit': self.submit(self.text()); break;
      case 'cancel': self.cancel(); break;
    };
  });
}
Field.prototype.__proto__ = Editor.prototype;

Field.prototype.submit = function (value) { this.emit('submit', value); }
Field.prototype.cancel = function () { this.emit('cancel'); }

module.exports = Field;
