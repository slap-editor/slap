#!/usr/bin/env node
/*global require, global*/

var test = require('tape');
var markup = require('../lib/markup');

test("markup", function (t) {
  t.test(".markupIndex", function (st) {
    st.test("should treat {open} and {close} as single characters", function (sst) {
      sst.plan(3);

      var str = "Curlies{open}!{close}";
      sst.equal(str.slice(markup.markupIndex(str, 7)), "{open}!{close}");
      sst.equal(str.slice(markup.markupIndex(str, 8)), "!{close}");
      sst.equal(str.slice(markup.markupIndex(str, 9)), "{close}");
    });
    st.test("should get indices correctly", function (sst) {
      sst.plan(4);

      var str = "{inverse}Markup {green-fg}{/green-fg}{/inverse}{bold}.{/bold}";
      sst.equal(markup.markupIndex(str, 0), 0);
      sst.equal(markup.markupIndex(str, 1), 10);
      sst.equal(str.slice(markup.markupIndex(str, 7)), "{bold}.{/bold}");
      sst.equal(markup.markupIndex(str, Infinity), str.length);
    });
  });
  t.test(".escapeCurlies", function (st) {
    st.test("should escape curlies", function (sst) {
      sst.plan(1);

      sst.equal(markup.escapeCurlies("open: {, close: }"), "open: {open}, close: {close}");
    });
  });
});
