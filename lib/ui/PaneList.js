var _ = require('lodash');

var util = require('slap-util');
var BaseWidget = require('base-widget');

var Pane = require('./Pane');
var Slap = require('./Slap');

PaneList.prototype.__proto__ = Pane.prototype;
function PaneList (opts) {
  var self = this;

  if (!(self instanceof PaneList)) return new PaneList(opts);

  Pane.call(self, _.merge({}, Slap.global.options.paneList, opts));

  self.topContent = new BaseWidget(_.merge({
    parent: self,
    tags: true,
    shrink: true,
    top: 1,
    left: 'center',
    style: self.options.style
  }, self.options.topContent));

  var listOpts = _.merge({
    parent: self,
    mouse: true,
    keys: true,
    focusable: true,
    tags: true,
    top: 3,
    style: self.options.style
  }, self.options.list);
  self.list = new BaseWidget.blessed.List(listOpts);
  BaseWidget.call(self.list, listOpts);
}

PaneList.prototype.close = function () {
  // Don't actually close anything, just act closed and maybe setFront another pane
  var self = this;
  var slap = self.screen.slap;
  if (self === slap.getCurrentPane()) {
    var prevPane = slap.getPrevPane();
    if (prevPane) prevPane.setCurrent();
  }
  return true;
};

PaneList.prototype.getTitle = function () {
  return util.markup("<PaneList>", this.style.paneList).toString();
};

PaneList.prototype._initHandlers = function () {
  var self = this;
  var slap = self.screen.slap;

  self.on('element mousedown', function (el) { self.focus(); });

  slap.on('element keypress', function (el, ch, key) {
    if (!(el === self || el.hasAncestor(self))) return;
    switch (self.resolveBinding(key)) {
      case 'cancel':
        var prevPane = slap.getPrevPane();
        if (prevPane) prevPane.setCurrent();
        return false;
    }
  });

  self.on('focus', function () { self.screen.program.hideCursor(); });

  self.update();
  ['adopt', 'remove'].forEach(function (evt) {
    slap.on('element '+evt, function (parent, child) {
      if (child instanceof Pane) setImmediate(function () { self.update(); });
    });
  });

  self.list.on('select', function (_, i) {
    slap._stopKeyPropagation().then(function () {
      slap.panes[i].setCurrent();
    });
  });

  return Pane.prototype._initHandlers.apply(self, arguments);
};
PaneList.prototype.update = function () {
  var self = this;
  var slap = self.screen.slap;

  var list = self.list;
  var items = slap.panes.reduce(function (items, pane) {
    var title = pane.getTitle();
    if (title !== null) items.push(title);
    return items;
  }, []);
  list.setItems(items);

  var topContent = self.topContent;
  topContent.setContent(items.length+" pane"+(items.length === 1 ? '' : 's')+" open");

  return self;
};

module.exports = PaneList;
