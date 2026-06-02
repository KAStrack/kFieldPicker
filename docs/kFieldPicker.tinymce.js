/*!
 * kFieldPicker — TinyMCE adapter v0.1.1
 * Optional add-on. Registers a 'tinymce' adapter so kFieldPicker can drive a
 * TinyMCE editor (iframe or inline). Load AFTER kFieldPicker.js and TinyMCE.
 *
 *   tinymce.init({
 *     selector: '#editor',
 *     setup: function (editor) {
 *       editor.on('init', function () {
 *         kFieldPicker(editor, { adapter: 'tinymce', trigger: '@', items: [...] });
 *       });
 *     },
 *   });
 *
 * Requires TinyMCE 5+ (uses editor.on(..., prepend) and the event object's
 * isDefaultPrevented/stopImmediatePropagation). No other dependencies.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd)            define(['kfieldpicker'], factory);
  else if (typeof module === 'object' && module.exports)    module.exports = factory(require('kfieldpicker'));
  else                                                       factory(root.kFieldPicker);
}(typeof self !== 'undefined' ? self : this, function (kFieldPicker) {
  'use strict';

  if (!kFieldPicker || typeof kFieldPicker.registerAdapter !== 'function') {
    throw new Error('kFieldPicker TinyMCE adapter: load kFieldPicker.js first.');
  }

  // The active Text node + caret offset, recovered from the live selection on
  // demand. Arrow/Enter navigation is preventDefaulted while the dropdown is
  // open, so the caret never moves between getQuery and insert/getCaretCoords.
  function activeTextContext(editor) {
    if (!editor.selection) return null;
    var rng = editor.selection.getRng();
    if (!rng) return null;
    var node = rng.startContainer;
    if (!node || node.nodeType !== 3) return null; // need a Text node
    return { node: node, offset: rng.startOffset };
  }

  function fireInput(editor) {
    if (typeof editor.dispatch === 'function')    editor.dispatch('input');
    else if (typeof editor.fire === 'function')   editor.fire('input');
  }

  kFieldPicker.registerAdapter('tinymce', {

    getQuery: function (editor, trigger) {
      var ctx = activeTextContext(editor);
      if (!ctx) return null;
      var before      = ctx.node.textContent.substring(0, ctx.offset);
      var lastTrigger = before.lastIndexOf(trigger);
      if (lastTrigger === -1) return null;
      var between = before.substring(lastTrigger + trigger.length);
      if (/\s/.test(between)) return null;
      return { query: between, triggerPos: lastTrigger, cursorPos: ctx.offset };
    },

    insert: function (editor, text, triggerPos, cursorPos) {
      var ctx = activeTextContext(editor);
      if (!ctx) { editor.insertContent(editor.dom.encode(text)); return; }
      var node = ctx.node;
      var full = node.textContent;
      node.textContent = full.substring(0, triggerPos) + text + full.substring(cursorPos);

      var caret = Math.min(triggerPos + text.length, node.textContent.length);
      var r = editor.getDoc().createRange();
      r.setStart(node, caret);
      r.collapse(true);
      editor.selection.setRng(r);
      editor.focus();

      try { editor.undoManager.add(); } catch (e) {}
      fireInput(editor);
    },

    getCaretCoords: function (editor, pos) {
      var ctx = activeTextContext(editor);
      if (!ctx) return null;
      var node = ctx.node;
      var off  = Math.min(pos, node.textContent.length);
      var r    = editor.getDoc().createRange();
      try { r.setStart(node, off); r.setEnd(node, off); }
      catch (e) { return null; }

      var rect = r.getBoundingClientRect();
      if (!rect || (!rect.top && !rect.left && !rect.height && !rect.width)) {
        rect = (node.parentNode || node).getBoundingClientRect();
      }
      // `rect` is relative to the editor document's viewport. For an iframe
      // editor, add the iframe element's position in the top document; inline
      // editors share the document, so there's no offset.
      var iframe = editor.iframeElement;
      var io     = iframe ? iframe.getBoundingClientRect() : { left: 0, top: 0 };
      var top    = io.top  + rect.top;
      var left   = io.left + rect.left;
      var h      = rect.height || 18;
      return { top: top, left: left, bottom: top + h };
    },

    // Element the combobox ARIA is applied to. Cross-document aria-controls /
    // aria-activedescendant only resolve for inline editors (same document as
    // the listbox); for iframe editors they're harmlessly ignored by AT.
    getAriaTarget: function (editor) {
      try { return editor.getBody(); } catch (e) { return null; }
    },

    bind: function (editor, onInput, onKeydown, onReposition) {
      // Prepend our keydown so it runs BEFORE TinyMCE's core handlers. When the
      // dropdown is open and we preventDefault, we also stop immediate
      // propagation so Enter/Tab/arrows don't also act on the editor.
      var keydownProxy = function (e) {
        onKeydown(e);
        if (e.isDefaultPrevented && e.isDefaultPrevented()) e.stopImmediatePropagation();
      };
      editor.on('keydown', keydownProxy, true);
      editor.on('input', onInput);

      var reposition = onReposition ? function () { onReposition(); } : null;
      if (reposition) {
        // Editor content scrolls inside its own (iframed) window, which the
        // top-window scroll listener can't observe — reposition on it too.
        try { editor.getWin().addEventListener('scroll', reposition, true); } catch (e) {}
        editor.on('ScrollWindow ScrollContent', reposition);
      }

      return function () {
        editor.off('keydown', keydownProxy);
        editor.off('input', onInput);
        if (reposition) {
          try { editor.getWin().removeEventListener('scroll', reposition, true); } catch (e) {}
          editor.off('ScrollWindow ScrollContent', reposition);
        }
      };
    },
  });

  return kFieldPicker;
}));
