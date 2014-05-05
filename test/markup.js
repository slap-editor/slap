#!/usr/bin/env node
/*global require, global*/

var test = require('tape');
var markup = require('../lib/markup');

test("markup", function (t) {
  t.test(".index", function (st) {
    st.test("should treat {open} and {close} as single characters", function (sst) {
      sst.plan(3);

      var str = "Curlies{open}!{close}";
      sst.equal(str.slice(markup.index(str, 7)), "{open}!{close}");
      sst.equal(str.slice(markup.index(str, 8)), "!{close}");
      sst.equal(str.slice(markup.index(str, 9)), "{close}");
    });
    st.test("should get indices correctly", function (sst) {
      sst.plan(4);

      var str = "{inverse}Markup {green-fg}{/green-fg}{/inverse}{bold}.{/bold}";
      sst.equal(markup.index(str, 0), 0);
      sst.equal(markup.index(str, 1), 10);
      sst.equal(str.slice(markup.index(str, 7)), "{bold}.{/bold}");
      sst.equal(markup.index(str, Infinity), str.length);
    });
  });
  t.test(".escape", function (st) {
    st.test("should escape curlies", function (sst) {
      sst.plan(1);

      sst.equal(markup.escape("open: {, close: }"), "open: {open}, close: {close}");
    });
  });
});
