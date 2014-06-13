var blessed = require('blessed');
var _ = require('lazy.js');
var traverse = require('traverse');

var BaseDialog = require('./BaseDialog');
var Editor = require('./Editor');
var markup = require('../markup');

function HelpDialog (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new HelpDialog(opts);

  BaseDialog.call(self, _({
    tags: true,
    content: markup("Help", '{center}{bold}')
  }).merge(opts || {}).toObject());
  delete opts.parent;

  self.helpContent = new Editor(_({
    parent: self,
    top: self.padding.top + 2,
    left: self.padding.left,
    right: self.padding.right,
    bottom: self.padding.bottom
  })
    .merge(_(self.screen.options.editor).omit(['visibleWhiteSpace', 'visibleLineEndings']).toObject())
    .merge({gutter: {hidden: true}})
    .merge(opts || {})
    .toObject())

  var paths = {};
  traverse(self.parent.options).forEach(function (binding) {
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

  self.okButton = blessed.Button({
    parent: self,
    content: "Okay",
    mouse: true,
    input: true,
    bottom: 1,
    right: 1,
    shrink: true,
    padding: {left: 1, right: 1},
    style: {focus: {bg: 'blue'}, hover: {bg: 'blue'}}
  });

  self.on('show', function () { self.okButton.focus(); });
}
HelpDialog.prototype.__proto__ = BaseDialog.prototype;

module.exports = HelpDialog;
