var blessed = require('blessed');
var _ = require('lazy.js');

var Editor = require('./editor');
var util = require('./util');
var textUtil = require('./textUtil');

function Field (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new Field(opts);

  Editor.call(self, _({height: 1}).merge(opts).toObject());
  self.language(false);
  self.on('keypress', function (ch, key) {
    var binding = util.getBinding(self.options.bindings, key);
    switch (binding) {
      case 'submit':
        self.submit(self.text());
        break;
      case 'submit':
        self.cancel();
        break;
    };
  });
}
Field.prototype.__proto__ = Editor.prototype;

Field.prototype.change = function (text) {
  return Editor.prototype.change.apply(this, [
    textUtil.stripLine(textUtil._getString(text))
  ].concat(util.toArray(arguments).slice(1)));
};

Field.prototype.submit = function (val) { this.emit('submit', val); }
Field.prototype.cancel = function () { this.emit('cancel'); }

module.exports = Field;
