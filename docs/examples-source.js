/*
 * examples-source.js — fills each card's "View source" panel.
 *
 * Rather than duplicate the demo code into index.html (which would drift), this
 * fetches examples.js at runtime and slices it into per-example blocks using the
 * "// ─── N. Title ───" section markers. The snippet you read is therefore the
 * exact code that's running on the page. Requires an HTTP server (like the ajax
 * example); on a file:// URL fetch fails and the panels are hidden.
 */
(function () {
  if (!window.fetch || !document.querySelector) return;

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Single-pass tokenizer — comments, strings, keywords, numbers. Matching all
  // token kinds in one regex means a "//" inside a string is consumed as part of
  // the string, never mistaken for a comment.
  function highlight(code) {
    var re = /(\/\/[^\n]*)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(function|return|var|new|if|else|true|false|null)\b|\b(\d+(?:\.\d+)?)\b/g;
    var out = '', last = 0, m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      if (m[1])      out += '<span class="tok-com">' + esc(m[1]) + '</span>';
      else if (m[2]) out += '<span class="tok-str">' + esc(m[2]) + '</span>';
      else if (m[3]) out += '<span class="tok-kw">'  + esc(m[3]) + '</span>';
      else           out += '<span class="tok-num">' + esc(m[4]) + '</span>';
      last = re.lastIndex;
    }
    return out + esc(code.slice(last));
  }

  function clean(block) {
    return block
      .replace(/^  \/\/ ─── \d+\.[^\n]*\n/, '')  // drop the "// ─── N. Title ───" header line
      .replace(/\n\}\);\s*$/, '')                // drop the DOMContentLoaded closer (last block only)
      .replace(/^ {2}/gm, '')                    // dedent the two-space wrapper indent
      .replace(/^\n+/, '')
      .replace(/\s+$/, '');
  }

  function fill(src) {
    // Split before each "  // ─── N." marker, keeping the marker with its block.
    var blocks = src.split(/\n(?=  \/\/ ─── \d+\.)/);
    for (var i = 0; i < blocks.length; i++) {
      var m = blocks[i].match(/^  \/\/ ─── (\d+)\./);
      if (!m) continue;  // blocks[0] is the preamble (setOutput helper) — skip it
      var el = document.querySelector('.example-src[data-example="' + m[1] + '"]');
      if (el) el.innerHTML = highlight(clean(blocks[i]));
    }
  }

  function hideAll() {
    var nodes = document.querySelectorAll('details.src');
    for (var i = 0; i < nodes.length; i++) nodes[i].style.display = 'none';
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetch('examples.js')
      .then(function (r) { return r.ok ? r.text() : Promise.reject(); })
      .then(fill)
      .catch(hideAll);
  });
}());
