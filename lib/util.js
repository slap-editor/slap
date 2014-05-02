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
  },

  escapeRegExp: function (text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  },

  regExpIndexOf: function(str, regex, index) {
    index = index || 0;
    var offset = str.slice(index).search(regex);
    return (offset >= 0) ? (index + offset) : offset;
  },

  regExpLastIndexOf: function (str, regex, index) {
    if(index === 0 || index) { str = str.slice(0, Math.max(0, index)); }
    var i;
    var offset = -1;
    while ((i = str.search(regex)) !== -1) {
      offset += i + 1;
      str = str.slice(i + 1);
    }
    return offset;
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
});

module.exports = util;
