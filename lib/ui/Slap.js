var _ = require('lazy.js');
var lodash = require('lodash');
var blessed = require('blessed');
var path = require('path');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));

var Header = require('./Header');
var Editor = require('./Editor');
var FileBrowser = require('./FileBrowser');
var SaveAsForm = require('./SaveAsForm');
var FindForm = require('./FindForm');
var GoLineForm = require('./GoLineForm');
var UnsavedChangesDialog = require('./UnsavedChangesDialog');
var HelpDialog = require('./HelpDialog');

var util = require('../util');

function Slap (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new Slap(opts);

  blessed.Screen.call(self, _(opts).merge({handleUncaughtExceptions: false}).toObject());

  self.header = new Header(_(opts.header || {}).merge({parent: self}).toObject());

  self.fileBrowser = new FileBrowser(_({
    parent: self,
    top: 1,
    left: 0,
    bottom: 0
  }).merge(opts.fileBrowser || {}).toObject());

  self.editor = new Editor(_({
    parent: self,
    top: 1,
    left: self.fileBrowser.visible ? self.fileBrowser.width : 0,
    right: 0,
    bottom: 0
  }).merge(opts.editor || {}).toObject());
  self.editor.focus();

  self.fieldOptions = _(opts.editor || {}).merge(opts.field || {}).toObject();
  self.modalOptions = _(opts.modal || {}).merge({
    parent: self,
    field: self.fieldOptions
  }).toObject();
  self.formOptions = _(self.modalOptions).merge(opts.form || {}).toObject();
  self.findFormOptions = _(self.formOptions || {}).merge(opts.findForm || {}).merge({
    prevEditorState: {}
  }).toObject();

  self.findForm = new FindForm(self.findFormOptions);
  self.goLineForm = new GoLineForm(self.findFormOptions);
  self.saveAsForm = new SaveAsForm(self.formOptions);

  self.unsavedChangesDialog = new UnsavedChangesDialog(self.modalOptions);
  self.helpDialog = new HelpDialog(self.modalOptions);

  self
    .toggleInsertMode()
    ._initHandlers();
}
Slap.prototype.__proto__ = blessed.Screen.prototype;

Slap.normalizePath = function (givenPath) {
  if (!givenPath) givenPath = '';
  if (givenPath[0] === '~') {
    givenPath = path.join(process.platform !== 'win32'
      ? process.env.HOME
      : process.env.USERPROFILE
    , givenPath.slice(1));
  }
  return path.normalize(givenPath);
};
Slap.prototype.path = util.getterSetter('path', null, Slap.normalizePath);
Slap.prototype.open = function (givenPath) {
  var self = this;
  givenPath = Slap.normalizePath(givenPath);
  return fs.readFileAsync(givenPath)
    .then(function (data) {
      self.path(givenPath);
      self.editor.text(data, path.extname(givenPath).slice(1));
    })
    .catch(function (err) {
      switch ((err.cause || {}).code) {
        case 'EISDIR':
          self.fileBrowser.refresh(givenPath, _.noop);
          break;
        case 'EACCES':
          self.header.message(err.message, 'error');
        case 'ENOENT':
          self.editor.changeStack.savePosition = null;
          self.render();
          break;
        default: throw err;
      }
    });
};
Slap.prototype.save = function (givenPath) {
  var self = this;
  givenPath = givenPath ? Slap.normalizePath(givenPath) : self.path();
  if (!givenPath) return;

  var text = self.editor.text();
  return fs.writeFileAsync(givenPath, text, {flags: 'w'})
    .then(function () {
      self.editor.changeStack.save();
      self.emit('save', givenPath, text);
      self.path(givenPath);
      self.header.message("saved to " + givenPath, 'success');
    })
    .catch(function (err) {
      switch (err.cause.code) {
        case 'EACCES': case 'EISDIR':
          self.header.message(err.message, 'error');
          break;
        default: throw err;
      }
    });
};
Slap.prototype.insertMode = util.getterSetter('insertMode', null, Boolean);
Slap.prototype.toggleInsertMode = function () { return this.insertMode(!this.insertMode()); };

Slap.prototype.quit = function () {
  process.exit(0);

  return this; // Just in case
};

Slap.prototype._initHandlers = function () {
  var self = this;

  self.on('element keypress', function (el, ch, key) {
    switch (util.getBinding(self.options.bindings, key)) {
      case 'quit':
        var newEmptyFile = self.editor.changeStack.savePosition === null && !self.editor.text();
        if (self.editor.changeStack.dirty() && !newEmptyFile) {
          self.unsavedChangesDialog.show();
        } else {
          self.quit();
        }
        break;
      case 'help': self.helpDialog.show(); break;
      case 'open': 
        if ( !self.fileBrowser.visible ) {
          self.fileBrowser.show();
          self.editor.left = self.fileBrowser.width;
        }
        self.fileBrowser.focus(); 
        break;
      case 'save': self.path() ? self.save().done() : self.saveAsForm.show(); break;
      case 'saveAs': self.saveAsForm.show(); break;
      case 'find': self.findForm.show(); break;
      case 'goLine': self.goLineForm.show(); break;
      case 'toggleInsertMode': self.toggleInsertMode(); break;
      case 'toggleFileBrowser': 
        self.fileBrowser.toggle();
        self.editor.left = self.fileBrowser.visible ? self.fileBrowser.width : 0; 
        break;
    }
  });

  self.on('element blur', function (el) { if (el._updateCursor) el._updateCursor(); });

  self.on('path', function (givenPath) { self.editor.language(path.extname(givenPath).slice(1)); });

  self.editor.on('keypress', function (ch, key) {
    if (key.action !== 'mousemove') self.header.message(null);
  });

  self.fileBrowser.on('file', function (path) {
    self.open(path).done();
    self.editor.focus();
  });
  self.fileBrowser.on('cancel', function () { self.editor.focus(); });

  ['resize', 'element focus', 'save', 'path', 'insertMode'].forEach(function (evt) {
    self.on(evt, function () { self.render(); });
  });
  ['change', 'cursor'].forEach(function (evt) {
    self.editor.on(evt, function () { self.header.render(); });
  });

  return self;
};

Slap.prototype.render = lodash.throttle(function () {
  return blessed.Screen.prototype.render.apply(this, arguments);
}, 33);

module.exports = Slap;
