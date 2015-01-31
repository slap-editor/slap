var blessed = require('blessed');
var _ = require('lazy.js');
var lodash = require('lodash');
var Point = require('text-buffer/lib/point');

var Slap = require('./Slap');
var BaseElement = require('./BaseElement');
var BaseFindForm = require('./BaseFindForm');

var textUtil = require('../textUtil');

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

FindForm.prototype.selectRange = function (range) {
  var self = this;
  var editor = self.pane.editor;
  var selection = editor.selection;
  selection.setRange(range);
  var visibleRange = editor.visiblePos(range);
  editor.clipScroll([visibleRange.start, visibleRange.end]);
  return self;
};
FindForm.prototype._initHandlers = function () {
  var self = this;
  var header = self.slap.header;
  var editor = self.pane.editor;
  var selection = editor.selection;

  self.on('hide', function () {
    editor.destroyMarkers({type: 'findMatch'});
    editor._updateContent();
  });
  self.on('find', lodash.throttle(function (pattern, direction) {
    direction = direction || 0;
    editor.destroyMarkers({type: 'findMatch'});
    var regExpMatch = pattern.match(textUtil._regExpRegExp);
    pattern = regExpMatch
      ? new RegExp(regExpMatch[1], regExpMatch[2])
      : new RegExp(textUtil.escapeRegExp(pattern), 'img');

    var selectionRange = selection.getRange();
    var matches = [];
    editor.textBuf[direction === -1
      ? 'backwardsScan'
      : 'scan'](pattern, function (match) {
      matches.push(match);
      editor.textBuf.markRange(match.range, {type: 'findMatch'});
    });

    if (!matches.length) {
      header.message("no matches", 'warning');
      self.resetEditor();
      return;
    }
    if (!matches.some(function (match) {
      var matchRange = match.range;
      var cmp = matchRange.start.compare(selectionRange.start);
      if (cmp === direction) {
        self.selectRange(matchRange);
        return true;
      } else if (!cmp && matches.length === 1) {
        header.message("this is the only occurrence", 'info');
        return true;
      }
    })) {
      header.message("search wrapped", 'info');
      self.selectRange(matches[0].range);
    }
    editor._updateContent();
  }, self.options.perf.findThrottle));
  return BaseFindForm.prototype._initHandlers.apply(self, arguments);
};

module.exports = FindForm;
