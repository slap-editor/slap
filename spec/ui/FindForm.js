#!/usr/bin/env node
/*global require, global*/

var test = require('tape');

var FindForm = require('../../lib/ui/FindForm');

test("FindForm._regExpRegExp", function (t) {
  t.test("_regExpRegExp", function (st) {
    var regex = FindForm._regExpRegExp;

    st.test("should not match plain strings", function (sst) {
      sst.plan(1);
      sst.equal('(.*)\\1[^a]+'.match(regex), null);
    });

    st.test("should not match empty regex", function (sst) {
      sst.plan(1);
      sst.equal('//'.match(regex), null);
    });

    st.test("should support basic regex", function (sst) {
      sst.plan(4);
      var m = '/(.*)\\1[^a]+/'.match(regex);

      sst.notEqual(m, null);
      sst.equal(m.length, 3);
      sst.equal(m[1], '(.*)\\1[^a]+');
      sst.equal(m[2], '');
    });

    st.test("should support case insensitive modifier", function (sst) {
      sst.plan(4);
      var m = '/abc/i'.match(regex);

      sst.notEqual(m, null);
      sst.equal(m.length, 3);
      sst.equal(m[1], 'abc');
      sst.equal(m[2], 'i');
    });

    st.test("should support global modifier", function (sst) {
      sst.plan(4);
      var m = '/abc/g'.match(regex);

      sst.notEqual(m, null);
      sst.equal(m.length, 3);
      sst.equal(m[1], 'abc');
      sst.equal(m[2], 'g');
    });

    st.test("should support multiline modifier", function (sst) {
      sst.plan(4);
      var m = '/abc/m'.match(regex);

      sst.notEqual(m, null);
      sst.equal(m.length, 3);
      sst.equal(m[1], 'abc');
      sst.equal(m[2], 'm');
    });

    st.test("should support multiple modifiers", function (sst) {
      sst.plan(4);
      var m = '/abc/gmi'.match(regex);

      sst.notEqual(m, null);
      sst.equal(m.length, 3);
      sst.equal(m[1], 'abc');
      sst.equal(m[2], 'gmi');
    });
  });
});
