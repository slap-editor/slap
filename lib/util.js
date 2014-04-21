var _ = require('lazy.js');
var extend = require('xtend');

var util = extend(require('util'), {
  clone: extend,
  extend: extend,

  getterSetter: function (name, getter, setter) {
    var _name = '_'+name;
    getter = getter || _.identity;
    setter = setter || _.identity;
    return function () {
      if (arguments.length) {
        var newVal = setter.apply(this, arguments);
        this[_name] = newVal;
        this.emit && this.emit(name, getter.call(this, newVal));
        return this;
      } else {
        return getter.call(this, this[_name]);
      }
    };
  }
});

module.exports = util;
