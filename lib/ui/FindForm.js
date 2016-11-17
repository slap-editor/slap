var _ = require('lodash');
var lodash = require('lodash');

var util = require('slap-util');

var BaseWidget = require('base-widget');
var Slap = require('./Slap');
var BaseFindForm = require('./BaseFindForm');
var Label = require('./Label');

FindForm._label = " find (/.*/ for regex): ";
FindForm._regExpRegExp = /^\/(.+)\/(\w*)$/i;
FindForm._invalidRegExpMessageRegExp = /^(Invalid regular expression:|Invalid flags supplied to RegExp constructor)/;
function FindForm (opts) {
  var self = this;

  if (!(self instanceof FindForm)) return new FindForm(opts);

  BaseFindForm.call(self, _.merge({
    findField: {left: FindForm._label.length}
  }, Slap.global.options.form.find, opts));

  self.findLabel = new Label(_.merge({
    parent: self,
    tags: true,
    content: FindForm._label,
    top: 0,
    left: 0,
    width: FindForm._label.length,
  }, self.options.findLabel));
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
  var header = self.screen.slap.header;
  var editor = self.pane.editor;
  var selection = editor.selection;

  self.on('hide', function () {
    editor.destroyMarkers({type: 'findMatch'});
    editor._updateContent();
  });
  self.on('find', lodash.throttle(function (pattern, direction) {
    direction = direction || 0;
    editor.destroyMarkers({type: 'findMatch'});
    try {
      var regExpMatch = pattern.match(FindForm._regExpRegExp);
      pattern = new RegExp(regExpMatch[1], regExpMatch[2].replace('g', '') + 'g');
    } catch (e) {
      if (e.message.match(FindForm._invalidRegExpMessageRegExp)) {
        header.message(e.message, 'error');
        self.resetEditor();
        return;
      }
      pattern = new RegExp(_.escapeRegExp(pattern), 'img');
    }

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

  self.findField.on('keypress', function (ch, key) {
    var text = self.findField.textBuf.getText();
    switch (self.resolveBinding(key)) {
      case 'next': self.find(text, 1); return false;
      case 'prev': self.find(text, -1); return false;
    };
  });

  return BaseFindForm.prototype._initHandlers.apply(self, arguments);
};

module.exports = FindForm;
