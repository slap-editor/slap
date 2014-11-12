var blessed = require('blessed');
var _ = require('lazy.js');
var traverse = require('traverse');

var Slap = require('./Slap');
var BaseDialog = require('./BaseDialog');
var Editor = require('./Editor');
var Button = require('./Button');

var markup = require('../markup');

function HelpDialog (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new HelpDialog(opts);

  BaseDialog.call(self, _({
      content: markup("Help", '{center}{bold}')
    })
    .merge(Slap.global.options.dialog.help || {})
    .merge(opts || {})
    .toObject());

  self.helpContent = new Editor(_({
      parent: self,
      buffer: {visibleWhiteSpace: false, visibleLineEndings: false},
      gutter: {hidden: true},
      top: self.padding.top + 2,
      left: self.padding.left,
      right: self.padding.right,
      bottom: self.padding.bottom
    })
    .merge(self.options.helpContent || {})
    .toObject());

  var paths = {};
  traverse(self.slap.options).forEach(function (binding) {
    if (this.path.indexOf('bindings') !== -1) {
      var keyNumber = Number(this.key);
      if (Array.isArray(binding)) binding = binding.join(", ");
      else if (Array.isArray(this.parent) || !this.isLeaf || !this.key || keyNumber === keyNumber) return;

      var path = this.path.slice(0, -1).join('.');
      if (!(path in paths)) paths[path] = [];
      paths[path].push(this.key + ": " + binding);
    }
  });
  self.helpContent
    .readOnly(true)
    .text("Keybindings:\n" + _(paths).pairs()
      .sortBy(function (pair) { return (pair[0].match(/\./g) || []).length; })
      .map(function (pair) {
        return "\n[" + pair[0] + "]\n" + pair[1].join("\n");
      })
      .join("\n")
    , false);

  self.okButton = new Button({
    parent: self,
    content: "Okay",
    bottom: 1,
    right: 1
  });
}
HelpDialog.prototype.__proto__ = BaseDialog.prototype;

HelpDialog.prototype._initHandlers = function () {
  var self = this;
  self.on('show', function () { self.okButton.focus(); });
  return BaseDialog.prototype._initHandlers.apply(self, arguments);
};

module.exports = HelpDialog;
