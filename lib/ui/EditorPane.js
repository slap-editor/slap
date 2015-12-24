var _ = require('lodash');

var util = require('slap-util');

var Editor = require('editor-widget');

var Pane = require('./Pane');

EditorPane.prototype.__proto__ = Pane.prototype;
function EditorPane (opts) {
  var self = this;

  if (!(self instanceof EditorPane)) return new EditorPane(opts);

  Pane.call(self, _.merge({}, Slap.global.options.editorPane, opts));

  self.forms = self.forms || [];

  self.editor = new Editor(_.merge({
    parent: self,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  }, Slap.global.options.editor, self.options.editor));

  self.findForm = new FindForm({parent: self});
  self.goLineForm = new GoLineForm({parent: self});
  self.saveAsForm = new SaveAsForm({parent: self});
  self.saveAsCloseForm = new SaveAsCloseForm({parent: self});
}

EditorPane.prototype.close = function () {
  var self = this;
  if (self.editor.textBuf.isModified()) {
    var parent = self.parent;
    var currentPaneSaveAsCloseForm = ((parent.panes || [])[parent.data.currentPane] || {}).saveAsCloseForm || {};
    if (currentPaneSaveAsCloseForm.visible) {
      currentPaneSaveAsCloseForm.once('hide', self.close.bind(self));
    } else {
      self.setCurrent();
      self.saveAsCloseForm.show();
    }
    return false;
  }

  return Pane.prototype.close.apply(self, arguments);
};

EditorPane.prototype.save = function (path) {
  var self = this;
  var slap = self.screen.slap;
  var header = slap.header;
  var editor = self.editor;
  return editor.save(path, slap.fileBrowser.cwd)
    .tap(function () { header.message("saved to " + editor.textBuf.getPath(), 'success'); })
    .catch(function (err) {
      switch ((err.cause || err).code) {
        case 'EACCES': case 'EISDIR':
          header.message(err.message, 'error');
          break;
        default: throw err;
      }
    });
};

EditorPane.prototype._initHandlers = function () {
  var self = this;
  var editor = self.editor;
  self.on('element keypress', function (el, ch, key) {
    switch (self.resolveBinding(key)) {
      case 'save': if (!editor.readOnly()) editor.textBuf.getPath() ? self.save().done() : self.saveAsForm.show(); return false;
      case 'saveAs': if (!editor.readOnly()) self.saveAsForm.show(); return false;
      case 'close': self.close(); return false;
      case 'find': self.findForm.show(); return false;
      case 'goLine': self.goLineForm.show(); return false;
    }
  });

  self.on('focus', function () {
    self.setFront();
    var formHasFocus = false;
    var visibleForms = self.forms.filter(function (form) {
      formHasFocus = formHasFocus || form.hasFocus(true);
      return form.visible;
    });
    if (!formHasFocus && visibleForms.length) visibleForms[0].focus();
  });

  editor.on('insertMode', function () { self.screen.slap.header.render(); });
  ['onDidChange', 'onDidChangePath'].forEach(function (prop) {
    editor.textBuf[prop](function () { self.screen.slap.header.render(); });
  });

  return Pane.prototype._initHandlers.apply(self, arguments);
};

module.exports = EditorPane;

var Slap = require('./Slap');
var SaveAsForm = require('./SaveAsForm');
var SaveAsCloseForm = require('./SaveAsCloseForm');
var FindForm = require('./FindForm');
var GoLineForm = require('./GoLineForm');
