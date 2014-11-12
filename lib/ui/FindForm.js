var blessed = require('blessed');
var _ = require('lazy.js');
var lodash = require('lodash');

var Slap = require('./Slap');
var BaseElement = require('./BaseElement');
var BaseFindForm = require('./BaseFindForm');

var Coordinate = require('../Coordinate');
var textUtil = require('../textUtil');
var markup = require('../markup');

FindForm._label = " find (/.*/ for regex): ";
function FindForm (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new FindForm(opts);

  BaseFindForm.call(self, _({
      findField: {left: FindForm._label.length}
    })
    .merge(Slap.global.options.form.find || {})
    .merge(opts || {})
    .toObject());

  self.findLabel = new BaseElement(_({
      parent: self,
      tags: true,
      content: FindForm._label,
      top: 0,
      height: 1,
      left: 0,
      width: FindForm._label.length,
      style: self.options.style
    })
    .merge(self.options.findLabel || {})
    .toObject());
}
FindForm.prototype.__proto__ = BaseFindForm.prototype;

FindForm.prototype._initHandlers = function () {
  var self = this;
  self.on('find', lodash.throttle(function (pattern, direction) {
    var regExpMatch = pattern.match(textUtil._regExpRegExp);
    pattern = regExpMatch
      ? new RegExp(regExpMatch[1], regExpMatch[2])
      : new RegExp(textUtil.escapeRegExp(pattern), 'im');

    var editor = self.pane.editor;
    var selection = editor.select();
    var matches = editor.findAll(pattern);
    if (!matches.length) {
      self.slap.header.message("no matches", 'warning');
      self.resetEditor();
      return;
    }

    if (direction === -1) matches.reverse();
    if (!matches.some(function (match) {
      var cmp = Coordinate.linear.cmp(match.start, selection.start);
      if (!direction || cmp === direction) {
        editor.select(match);
        return true;
      } else if (!cmp && matches.length === 1) {
        self.slap.header.message("this is the only occurrence", 'info');
        return true;
      }
    })) {
      self.slap.header.message("search wrapped", 'info');
      editor.select(matches[0]);
    }
    editor.data.matches = matches;
    editor.render();
  }, 100));
  return BaseFindForm.prototype._initHandlers.apply(self, arguments);
};

module.exports = FindForm;
