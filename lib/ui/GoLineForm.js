var blessed = require('blessed');
var _ = require('lazy.js');

var Slap = require('./Slap');
var BaseElement = require('./BaseElement');
var BaseFindForm = require('./BaseFindForm');

var markup = require('../markup');

GoLineForm._label = " line number: ";
function GoLineForm (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new GoLineForm(opts);

  BaseFindForm.call(self, _({
      findField: {left: GoLineForm._label.length}
    })
    .merge(Slap.global.options.form.goLine || {})
    .merge(opts || {})
    .toObject());

  self.goLineLabel = new BaseElement(_({
      parent: self,
      tags: true,
      content: GoLineForm._label,
      top: 0,
      height: 1,
      left: 0,
      width: GoLineForm._label.length,
      style: self.options.style
    })
    .merge(self.options.goLineLabel || {})
    .toObject());
}
GoLineForm.prototype.__proto__ = BaseFindForm.prototype;

GoLineForm.prototype._initHandlers = function () {
  var self = this;
  self.on('find', function (lineNumber, direction) {
    lineNumber = Number(lineNumber) - 1;
    if (lineNumber !== lineNumber) return; // isNaN(lineNumber)
    self.pane.editor.select(null, {x: 0, y: lineNumber});
    if (direction) self.hide();
    return self;
  });
  return BaseFindForm.prototype._initHandlers.apply(self, arguments);
};

module.exports = GoLineForm;
