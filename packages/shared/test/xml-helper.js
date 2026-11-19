'use strict';
// Test helper shared by the SVG tests: a small strict XML well-formedness check.
const assert = require('node:assert/strict');

/** Small strict XML well-formedness check: one root, balanced tags, quoted attributes, valid entities. */
function assertWellFormed(xml) {
  const stack = [];
  let roots = 0;
  let i = 0;
  const ENTITY = /^&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/;
  const checkText = (t, where) => {
    for (let k = 0; k < t.length; k++) {
      if (t[k] === '<') assert.fail(`raw "<" in ${where}`);
      if (t[k] === '&' && !ENTITY.test(t.slice(k))) assert.fail(`bad entity in ${where}: ${t.slice(k, k + 12)}`);
    }
  };
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    if (lt < 0) {
      if (xml.slice(i).trim()) assert.fail('text after the root element');
      break;
    }
    const txt = xml.slice(i, lt);
    if (txt) {
      if (!stack.length && txt.trim()) assert.fail('text outside the root element');
      checkText(txt, 'text');
    }
    if (xml[lt + 1] === '/') {
      const m = /^<\/([A-Za-z_][\w:.-]*)>/.exec(xml.slice(lt));
      assert.ok(m, 'malformed closing tag at ' + lt);
      assert.equal(stack.pop(), m[1], 'unbalanced </' + m[1] + '>');
      i = lt + m[0].length;
      continue;
    }
    const m = /^<([A-Za-z_][\w:.-]*)((?:\s+[A-Za-z_][\w:.-]*="[^"]*")*)\s*(\/?)>/.exec(xml.slice(lt));
    assert.ok(m, 'malformed start tag at ' + lt + ': ' + xml.slice(lt, lt + 80));
    const names = [];
    m[2].replace(/([A-Za-z_][\w:.-]*)="([^"]*)"/g, (all, name, value) => {
      assert.ok(!names.includes(name), 'duplicate attribute ' + name);
      names.push(name);
      checkText(value, 'attribute ' + name);
    });
    if (!stack.length) roots++;
    if (!m[3]) stack.push(m[1]);
    i = lt + m[0].length;
  }
  assert.equal(stack.length, 0, 'unclosed elements: ' + stack.join(', '));
  assert.equal(roots, 1, 'exactly one root element');
}

module.exports = { assertWellFormed };
