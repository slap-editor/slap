var _ = require('lazy.js');
var extend = require('xtend');

var util = extend(require('util'), {
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
  }
});

module.exports = util;
