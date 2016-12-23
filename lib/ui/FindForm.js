var _ = require('lodash');
var lodash = require('lodash');

var util = require('slap-util');

var BaseWidget = require('base-widget');
var Slap = require('./Slap');
var BaseFindForm = require('./BaseFindForm');
var Label = require('./Label');
var Field = require('editor-widget').Field;
var Button = require('./Button');

FindForm._label = " Find (/.*/ for regex): ";
FindForm._regExpRegExp = /^\/(.+)\/(\w*)$/i;
FindForm._invalidRegExpMessageRegExp = /^(Invalid regular expression:|Invalid flags supplied to RegExp constructor)/;
function FindForm (opts) {
  var self = this;

  if (!(self instanceof FindForm)) return new FindForm(opts);

  BaseFindForm.call(self, _.merge({
    height: 2,
    findField: {left: FindForm._label.length}
  }, Slap.global.options.form.find, opts));

  self.replaceLabel = new Label(_.merge({
    parent: self,
    tags: true,
    content: ' Replace with: ',
    top: 1,
    height: 1,
    left: 0
  }, self.options.findLabel));

  self.replaceField = new Field(_.merge({
    parent: self,
    top: 1,
    left: 15,
    right: 9
  }, Slap.global.options.editor, Slap.global.options.field, self.options.replaceField));

  self.replaceButton = new Button(_.merge({
    parent: self,
    content: "Replace",
    top: 1,
    right: 0
  }, Slap.global.options.button, self.options.replaceButton));

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

  var findOrReplace = function (pattern, direction, replacement) {
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
        if (replacement) {
          editor.textBuf.setTextInRange(editor.selection.getRange(), replacement);
        }
        return true;
      } else if (!cmp && matches.length === 1) {
        header.message("this is the only occurrence", 'info');
        return true;
      }
    })) {
      header.message("search wrapped", 'info');
      self.selectRange(matches[0].range);
      if (replacement) {
        editor.textBuf.setTextInRange(editor.selection.getRange(), replacement);
      }
    }
    editor._updateContent();
  };

  self.on('find', lodash.throttle(findOrReplace, self.options.perf.findThrottle));

  self.replaceButton.on('press', lodash.throttle( function () {
    findOrReplace(self.findField.value(), 0, self.replaceField.value());
  }, self.options.perf.findThrottle));

  self.replaceField.on('keypress', function (ch, key) {
    var text = self.findField.value();
    switch (self.resolveBinding(key)) {
      case 'next': self.find(text, 1); return false;
      case 'prev': self.find(text, -1); return false;
      case 'submit': findOrReplace(text, 1, self.replaceField.value()); return false;
      case 'submitAlt': findOrReplace(text, -1, self.replaceField.value()); return false;
    };
  });

  self.findField.on('keypress', function (ch, key) {
    var text = self.findField.value();
    switch (self.resolveBinding(key)) {
      case 'next': self.find(text, 1); return false;
      case 'prev': self.find(text, -1); return false;
      case 'submit': self.find(text, 1); return false;
      case 'submitAlt': self.find(text, -1); return false;
    };
  });

  return BaseFindForm.prototype._initHandlers.apply(self, arguments);
};

module.exports = FindForm;
