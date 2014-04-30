#!/usr/bin/env node
/*global require, global*/

var test = require('tape');
var Editor = require('../lib/editor');

test("Editor", function (t) {
  t.test("._splitLines", function (st) {
    var text = "This is a line.\rThis is another line.\r\nHere's a third line.\n";
    var lines = Editor._splitLines(text);

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
  t.test("._markupIndex", function (st) {
    st.test("should treat {open} and {close} as single characters", function (sst) {
      sst.plan(3);

      var markup = "Curlies{open}!{close}";
      sst.equal(markup.slice(Editor._markupIndex(markup, 7)), "{open}!{close}");
      sst.equal(markup.slice(Editor._markupIndex(markup, 8)), "!{close}");
      sst.equal(markup.slice(Editor._markupIndex(markup, 9)), "{close}");
    });
    st.test("should get indices correctly", function (sst) {
      sst.plan(4);

      var markup = "{inverse}Markup {green-fg}{/green-fg}{/inverse}{bold}.{/bold}";
      sst.equal(Editor._markupIndex(markup, 0), 0);
      sst.equal(Editor._markupIndex(markup, 1), 10);
      sst.equal(markup.slice(Editor._markupIndex(markup, 7)), "{bold}.{/bold}");
      sst.equal(Editor._markupIndex(markup, Infinity), markup.length);
    });
  });
  t.test("._escapeCurlies", function (st) {
    st.test("should escape curlies", function (sst) {
      sst.plan(1);

      sst.equal(Editor._escapeCurlies("open: {, close: }"), "open: {open}, close: {close}");
    });
  });
});
