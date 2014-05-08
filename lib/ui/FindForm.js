var blessed = require('blessed');
var _ = require('lazy.js');

var BaseFindForm = require('./BaseFindForm');

var Coordinate = require('../Coordinate');
var textUtil = require('../textUtil');
var markup = require('../markup');

FindForm._label = " find (/.*/ for regex): ";
function FindForm (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new FindForm(opts);

  BaseFindForm.call(self, _({
    field: {left: FindForm._label.length}
  }).merge(opts || {}).toObject());

  self.findLabel = new blessed.Box({
    parent: self,
    tags: true,
    content: markup(FindForm._label, opts.style),
    top: 0,
    height: 1,
    left: 0,
    width: FindForm._label.length
  });

  self.on('find', function (pattern, direction) {
    var regExpMatch = pattern.match(textUtil._regExpRegExp);
    pattern = regExpMatch
      ? new RegExp(regExpMatch[1], regExpMatch[2])
      : new RegExp(textUtil.escapeRegExp(pattern), 'im');

    var selection = self.parent.editor.select();
    var matches = self.parent.editor.findAll(pattern);
    if (!matches.length) {
      self.parent.header.message("no matches", 'warning');
      self.resetEditor();
      return;
    }

    if (direction === -1) matches.reverse();
    if (!matches.some(function (match) {
      var cmp = Coordinate.linear.cmp(match.start, selection.start);
      if (!direction || cmp === direction) {
        self.parent.editor.select(match);
        return true;
      } else if (!cmp && matches.length === 1) {
        self.parent.header.message("this is the only occurrence", 'info');
        return true;
      }
    })) {
      self.parent.header.message("search wrapped", 'info');
      self.parent.editor.select(matches[0]);
    }
    self.parent.editor.data.matches = matches;
  });
}
FindForm.prototype.__proto__ = BaseFindForm.prototype;

module.exports = FindForm;
