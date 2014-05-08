var blessed = require('blessed');
var _ = require('lazy.js');

var BaseFindForm = require('./BaseFindForm');

var markup = require('../markup');

GoLineForm._label = " line number: ";
function GoLineForm (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new GoLineForm(opts);

  BaseFindForm.call(self, _({
    field: {left: GoLineForm._label.length}
  }).merge(opts || {}).toObject());

  self.goLineLabel = new blessed.Box({
    parent: self,
    tags: true,
    content: markup(GoLineForm._label, opts.style),
    top: 0,
    height: 1,
    left: 0,
    width: GoLineForm._label.length
  });

  self.on('find', function (lineNumber, direction) {
    lineNumber = Number(lineNumber) - 1;
    if (lineNumber !== lineNumber) return; // isNaN(lineNumber)
    self.parent.editor.select(null, {x: 0, y: lineNumber});
    if (direction) self.hide();
    return self;
  });
}
GoLineForm.prototype.__proto__ = BaseFindForm.prototype;

module.exports = GoLineForm;
