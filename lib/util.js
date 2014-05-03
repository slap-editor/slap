var _ = require('lazy.js');
var extend = require('xtend');

var util = _(require('util')).merge({
  clone: extend,
  extend: extend,

  toArray: function (obj) { return [].slice.call(obj); },

  getterSetter: function (name, getter, setter) {
    getter = getter || _.identity;
    setter = setter || _.identity;
    return function () {
      if (arguments.length) {
        var newVal = setter.apply(this, arguments);
        this.data[name] = newVal;
        this.emit && this.emit(name, getter.call(this, newVal));
        return this;
      } else {
        return getter.call(this, this.data[name]);
      }
    };
  },

  getBinding: function (bindings, key) {
    var result;
    for (var name in bindings) {
      var keyBinding = bindings[name];
      if ((typeof keyBinding !== 'string' ? keyBinding : [keyBinding]).some(function (binding) {
        if (binding === key.full) { return true; }
      })) { result = name; }
    }
    return result;
  }
}).toObject();

module.exports = util;
