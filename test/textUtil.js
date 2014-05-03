#!/usr/bin/env node
/*global require, global*/

var test = require('tape');
var textUtil = require('../lib/textUtil');

test("textUtil", function (t) {
  t.test(".splitLines", function (st) {
    var text = "This is a line.\rThis is another line.\r\nHere's a third line.\n";
    var lines = textUtil.splitLines(text);

    st.test("should split on varying line endings correctly", function (sst) {
      sst.plan(4);

      sst.equal(lines[0], "This is a line.\r");
      sst.equal(lines[1], "This is another line.\r\n");
      sst.equal(lines[2], "Here's a third line.\n");
      sst.equal(lines[3], "");
    });
    st.test("should join back together to restore original string", function (sst) {
      sst.plan(1);

      sst.equal(lines.join(''), text);
    });
  });
});
