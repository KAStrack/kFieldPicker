/*!
 * kFieldPicker v0.1.9
 * A lightweight, configurable pattern/field picker for text inputs and textareas.
 * No dependencies. Easy install.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.kFieldPicker = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ─── Defaults ───────────────────────────────────────────────────────────────

  var DEFAULTS = {
    trigger: '#',
    closeChar: null,   // closing delimiter for token detection (e.g. '#' → #value#); null = none/auto bracket
    items: [],
    ajaxUrl: null,
    ajaxDebounce: 300,
    ajaxParams: {},
    ajaxFallback: false,
    ajaxTransform: null,
    minChars: 0,
    maxResults: 10,    // false / 0 → unlimited (show all matches)
    caseSensitive: false,
    insertTemplate: null,
    includeTriggerInInsert: false,
    appendSpace: true,
    noResultsText: 'No results found',
    showNoResults: true,
    highlightMatch: true,
    renderItem: null,
    allowFreeText: false,
    freeTextLabel: 'Add',
    dropdownClass: '',
    placement: 'auto',
    onOpen: null,
    onClose: null,
    onSelect: null,
    onNoResults: null,
    adapter: 'input',
  };

  // ─── Utilities ──────────────────────────────────────────────────────────────

  function merge() {
    var out = {};
    for (var i = 0; i < arguments.length; i++) {
      var obj = arguments[i];
      if (!obj) continue;
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) out[key] = obj[key];
      }
    }
    return out;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Bracket-style triggers (e.g. '{{', '[[', '((', '<<') have a natural closing
  // form, so a closed token ('{{first_name}}') shouldn't re-open the picker.
  var TRIGGER_CLOSE = { '{': '}', '[': ']', '(': ')', '<': '>' };
  function triggerCloseChar(trigger) {
    return (trigger && TRIGGER_CLOSE[trigger.charAt(0)]) || '';
  }

  // Locate the active query in `before` (the text up to the caret) for a given
  // trigger. Returns { query, triggerPos, cursorPos } or null (no open token).
  //
  // The closing delimiter is the explicit `closeChar` option, else the trigger's
  // bracket mirror (above), else none. Two cases:
  //
  //  • No closer (e.g. '#', '@', '/'): the query is whatever follows the LAST
  //    trigger.
  //
  //  • With a closer: scan left→right tracking whether we're inside a token, and
  //    return the still-open token at the caret (null if the latest token is
  //    already closed). This covers asymmetric delimiters ('{{'…'}}') and, when
  //    closeChar === trigger, SYMMETRIC ones ('#'…'#' → '#cat#'): the opening and
  //    closing '#' are the same character, so naive lastIndexOf() would mistake a
  //    token's closing '#' for a fresh trigger. For a symmetric delimiter, a
  //    delimiter that sits right AFTER a space starts a fresh token (the previous
  //    one was abandoned mid-type) instead of closing — so '#guinea pig' keeps its
  //    space and stays searchable, while '#cat #dog' still treats '#dog' as new. A
  //    delimiter right after non-space content closes the token as usual.
  //
  // A query MAY contain spaces (so multi-word labels stay searchable), but must
  // not START with whitespace — a trigger immediately followed by a space isn't a
  // real token. Whether a trailing space keeps the picker open is then decided by
  // matching: _showResults closes it once a spaced query matches nothing.
  function extractQuery(before, cursor, trigger, closeChar) {
    var close = closeChar || triggerCloseChar(trigger);
    var query, triggerPos;
    if (!close) {
      var last = before.lastIndexOf(trigger);
      if (last === -1) return null;
      query = before.substring(last + trigger.length);
      triggerPos = last;
    } else {
      var symmetric = (close === trigger);
      var inside = false, openPos = -1, i = 0;
      while (i < before.length) {
        if (!inside && before.substr(i, trigger.length) === trigger) {
          inside = true; openPos = i; i += trigger.length;
        } else if (inside && before.substr(i, close.length) === close) {
          if (symmetric && i > 0 && /\s/.test(before.charAt(i - 1))) {
            openPos = i; i += trigger.length;        // symmetric '#' after a space → fresh opener
          } else {
            inside = false; i += close.length;       // token closed
          }
        } else {
          i += 1;
        }
      }
      if (!inside) return null;
      query = before.substring(openPos + trigger.length);
      triggerPos = openPos;
    }
    if (/^\s/.test(query)) return null;
    return { query: query, triggerPos: triggerPos, cursorPos: cursor };
  }

  function debounce(fn, ms) {
    var t;
    var wrapped = function () {
      var a = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, a); }, ms);
    };
    wrapped.cancel = function () { clearTimeout(t); };
    return wrapped;
  }

  // ─── Item normalisation & group flattening ───────────────────────────────────

  function normalizeLeaf(item) {
    if (typeof item === 'string') {
      return { label: item, value: item, description: null, data: null };
    }
    return {
      label:       item.label || item.value || String(item),
      value:       item.value !== undefined ? item.value : item.label,
      description: item.description || null,
      data:        item.data || null,
    };
  }

  function isGroup(item) {
    return item && typeof item === 'object' && Array.isArray(item.children);
  }

  // Recursively flatten items into render nodes, filtering leaves by regex.
  // re === null means "show all" (no query typed yet).
  // count.n tracks leaf items shown so far for maxResults enforcement.
  // maxResults falsy (false / 0 / null) → unlimited; show every match.
  function flattenItems(items, re, depth, maxResults, count) {
    var out = [];
    for (var i = 0; i < items.length; i++) {
      if (maxResults && count.n >= maxResults) break;
      var item = items[i];

      if (isGroup(item)) {
        var childNodes = flattenItems(item.children, re, depth + 1, maxResults, count);
        if (childNodes.length > 0) {
          out.push({ type: 'group', label: item.group || item.label || 'Group', depth: depth });
          for (var j = 0; j < childNodes.length; j++) out.push(childNodes[j]);
        }
      } else {
        var leaf = normalizeLeaf(item);
        // re === null → match everything; re set → must match label or value
        if (re !== null && !re.test(leaf.label) && !re.test(leaf.value)) continue;
        out.push({ type: 'item', label: leaf.label, value: leaf.value, description: leaf.description, data: leaf.data, depth: depth });
        count.n++;
      }
    }
    return out;
  }

  // Build the full flat render list for a given query string.
  // query === '' → show all items (up to maxResults), no filtering.
  // prefiltered === true → the source already filtered (async items function),
  // so skip the substring filter but still flatten, cap to maxResults, and
  // append the free-text row. Highlighting still uses the query downstream.
  function buildRenderList(items, query, options, prefiltered) {
    var re = null;
    // Only build a filter regex when there is an actual query to filter on
    if (!prefiltered && query !== '' && query !== null && query !== undefined) {
      var flags = options.caseSensitive ? '' : 'i';
      re = new RegExp(escapeRegex(query), flags);
    }
    var nodes = flattenItems(items, re, 0, options.maxResults, { n: 0 });

    // allowFreeText: offer the raw query as a selectable item (last) so the user
    // can insert text that isn't in the list. Suppressed when the query already
    // exactly matches a shown item's label or value (avoids a duplicate row).
    if (options.allowFreeText && query) {
      var needle = options.caseSensitive ? query : query.toLowerCase();
      var hasExact = false;
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].type !== 'item') continue;
        var lbl = options.caseSensitive ? nodes[i].label : String(nodes[i].label).toLowerCase();
        var val = options.caseSensitive ? nodes[i].value : String(nodes[i].value).toLowerCase();
        if (lbl === needle || val === needle) { hasExact = true; break; }
      }
      if (!hasExact) {
        nodes.push({ type: 'item', label: query, value: query, description: null, data: null, depth: 0, freeText: true });
      }
    }
    return nodes;
  }

  function countSelectableItems(nodes) {
    var n = 0;
    for (var i = 0; i < nodes.length; i++) if (nodes[i].type === 'item') n++;
    return n;
  }

  // ─── Caret coordinate helper ─────────────────────────────────────────────────
  // Returns { top, left, bottom } in viewport coordinates.

  function getCaretViewportCoords(el, pos) {
    var style   = window.getComputedStyle(el);
    var isInput = el.tagName === 'INPUT';
    var mirror  = document.createElement('div');
    var ms      = mirror.style;

    [
      'boxSizing',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch',
      'fontSize', 'lineHeight', 'fontFamily',
      'textAlign', 'textTransform', 'textIndent', 'textDecoration',
      'letterSpacing', 'wordSpacing',
    ].forEach(function (p) { ms[p] = style[p]; });

    // Force border-box and use the element's border-box width so the mirror's
    // *content* box (width − padding − border, all copied above) matches the
    // element's regardless of the element's own box-sizing. With content-box,
    // copying the element's box-sizing made the mirror too wide and textarea
    // text wrapped at the wrong column → wrong caret Y on wrapped lines.
    ms.boxSizing  = 'border-box';
    ms.width      = el.getBoundingClientRect().width + 'px';
    ms.position   = 'fixed';
    ms.visibility = 'hidden';
    ms.top        = '0';
    ms.left       = '0';
    ms.whiteSpace = isInput ? 'nowrap' : 'pre-wrap';
    ms.wordWrap   = 'break-word';
    ms.overflow   = 'hidden';

    mirror.appendChild(document.createTextNode(el.value.substring(0, pos)));
    var marker = document.createElement('span');
    marker.textContent = '\u200b';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);

    var elRect     = el.getBoundingClientRect();
    var markerRect = marker.getBoundingClientRect();
    document.body.removeChild(mirror);

    var left   = elRect.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft) + markerRect.left - (isInput ? el.scrollLeft : 0);
    var top    = elRect.top  + parseFloat(style.borderTopWidth)  + parseFloat(style.paddingTop)  + markerRect.top  - el.scrollTop;
    var lineH  = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;

    return { top: top, left: left, bottom: top + lineH };
  }

  // ─── Adapters ───────────────────────────────────────────────────────────────

  var adapters = {};

  adapters.input = {
    getQuery: function (el, trigger, closeChar) {
      var val    = el.value;
      var cursor = el.selectionStart;
      if (cursor === null || cursor === undefined) cursor = val.length;
      return extractQuery(val.substring(0, cursor), cursor, trigger, closeChar);
    },

    insert: function (el, text, triggerPos, cursorPos) {
      el.value = el.value.substring(0, triggerPos) + text + el.value.substring(cursorPos);
      var p = triggerPos + text.length;
      el.setSelectionRange(p, p);
      el.focus();
    },

    getCaretCoords: function (el, pos) {
      return getCaretViewportCoords(el, pos);
    },

    bind: function (el, onInput, onKeydown) {
      el.addEventListener('input', onInput);
      el.addEventListener('keydown', onKeydown);
      return function () {
        el.removeEventListener('input', onInput);
        el.removeEventListener('keydown', onKeydown);
      };
    },
  };

  // ─── Dropdown ───────────────────────────────────────────────────────────────

  var idCounter = 0; // for unique listbox / option ids (ARIA)

  function Dropdown(options) {
    this.options       = options;
    this.el            = null;
    this.nodes         = [];
    this.activeIndex   = -1;
    this.visible       = false;
    this.onSelect      = null;
    this.onActiveChange = null; // (optionId|null) → host updates aria-activedescendant
    this._hideTimer    = null;
    this._create();
  }

  Dropdown.prototype._create = function () {
    this.el = document.createElement('div');
    this.el.className = 'kfp-dropdown' +
      (this.options.dropdownClass ? ' ' + this.options.dropdownClass : '');
    this.el.id = 'kfp-listbox-' + (++idCounter);
    this.el.setAttribute('role', 'listbox');
    this.el.setAttribute('aria-label', 'Suggestions');
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
  };

  Dropdown.prototype.setNodes = function (nodes, query) {
    this.nodes       = nodes;
    this.activeIndex = -1;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].type === 'item') { this.activeIndex = i; break; }
    }
    this._render(query);
    this._notifyActive();
  };

  Dropdown.prototype._render = function (query) {
    var self = this;
    this.el.innerHTML = '';
    this.el.classList.remove('kfp-dropdown--loading');

    if (countSelectableItems(this.nodes) === 0 && this.nodes.length === 0) {
      if (this.options.showNoResults) {
        var noRes = document.createElement('div');
        noRes.className = 'kfp-no-results';
        noRes.textContent = this.options.noResultsText;
        this.el.appendChild(noRes);
      }
      return;
    }

    this.nodes.forEach(function (node, i) {
      if (node.type === 'group') {
        var header = document.createElement('div');
        header.className = 'kfp-group' + (node.depth > 0 ? ' kfp-group--nested' : '');
        header.style.setProperty('--kfp-depth', node.depth);
        header.textContent = node.label;
        self.el.appendChild(header);
        return;
      }

      var row = document.createElement('div');
      row.className = 'kfp-item' + (i === self.activeIndex ? ' kfp-item--active' : '') +
        (node.freeText ? ' kfp-item--free' : '');
      if (node.depth > 0) row.style.setProperty('--kfp-depth', node.depth);
      row.id = self.el.id + '-opt-' + i;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', i === self.activeIndex ? 'true' : 'false');

      // Custom renderer: owns the row's content (string → innerHTML, DOM node →
      // appended). A falsy return falls back to the default rendering below, so
      // renderItem can customise only some rows (e.g. just the free-text row).
      var rendered = false;
      if (typeof self.options.renderItem === 'function') {
        var custom = self.options.renderItem(
          { label: node.label, value: node.value, description: node.description, data: node.data, freeText: !!node.freeText },
          query
        );
        if (typeof custom === 'string')      { row.innerHTML = custom;   rendered = true; }
        else if (custom && custom.nodeType)  { row.appendChild(custom);  rendered = true; }
      }

      if (!rendered) {
        var inner = document.createElement('div');
        inner.className = 'kfp-item-inner';

        var label = document.createElement('span');
        label.className = 'kfp-item-label';
        if (self.options.highlightMatch && query) {
          label.innerHTML = self._highlight(escapeHtml(node.label), escapeHtml(query));
        } else {
          label.textContent = node.label;
        }
        inner.appendChild(label);

        if (node.description) {
          var desc = document.createElement('span');
          desc.className = 'kfp-item-description';
          desc.textContent = node.description;
          inner.appendChild(desc);
        }

        row.appendChild(inner);

        // Free-text row gets a trailing badge (e.g. "Add") to signal it inserts
        // the raw query rather than a predefined item.
        if (node.freeText && self.options.freeTextLabel) {
          var badge = document.createElement('span');
          badge.className = 'kfp-free-badge';
          badge.textContent = self.options.freeTextLabel;
          row.appendChild(badge);
        }
      }

      row.addEventListener('mousedown', function (e) {
        e.preventDefault();
        self._onSelectIndex(i);
      });
      row.addEventListener('mousemove', function () {
        if (self.activeIndex !== i) self._setActive(i);
      });

      self.el.appendChild(row);
    });
  };

  Dropdown.prototype._highlight = function (label, query) {
    var flags = this.options.caseSensitive ? 'g' : 'gi';
    return label.replace(new RegExp('(' + escapeRegex(query) + ')', flags), '<mark class="kfp-highlight">$1</mark>');
  };

  Dropdown.prototype._setActive = function (index) {
    if (index < 0 || index >= this.nodes.length || this.nodes[index].type !== 'item') return;

    // Build node-index → row-index map (group headers have no row)
    var nodeToRow = {}, rowIdx = 0;
    for (var i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i].type === 'item') nodeToRow[i] = rowIdx++;
    }

    var rows = this.el.querySelectorAll('.kfp-item');
    if (this.activeIndex >= 0 && nodeToRow[this.activeIndex] !== undefined) {
      var prev = rows[nodeToRow[this.activeIndex]];
      if (prev) { prev.classList.remove('kfp-item--active'); prev.setAttribute('aria-selected', 'false'); }
    }

    this.activeIndex = index;
    var next = rows[nodeToRow[index]];
    if (next) {
      next.classList.add('kfp-item--active');
      next.setAttribute('aria-selected', 'true');
      next.scrollIntoView({ block: 'nearest' });
    }
    this._notifyActive();
  };

  // Report the active option's id (or null) so the host can keep the input's
  // aria-activedescendant in sync with the visually highlighted row.
  Dropdown.prototype._notifyActive = function () {
    if (!this.onActiveChange) return;
    var active = this.el.querySelector('.kfp-item--active');
    this.onActiveChange(active ? active.id : null);
  };

  Dropdown.prototype.moveActive = function (dir) {
    if (!this.nodes.length) return;
    var next = this.activeIndex + dir;
    while (next >= 0 && next < this.nodes.length && this.nodes[next].type !== 'item') next += dir;
    if (next < 0) {
      next = this.nodes.length - 1;
      while (next >= 0 && this.nodes[next].type !== 'item') next--;
    } else if (next >= this.nodes.length) {
      next = 0;
      while (next < this.nodes.length && this.nodes[next].type !== 'item') next++;
    }
    if (next >= 0 && next < this.nodes.length) this._setActive(next);
  };

  Dropdown.prototype.selectActive = function () {
    if (this.activeIndex >= 0 && this.nodes[this.activeIndex] && this.nodes[this.activeIndex].type === 'item') {
      this._onSelectIndex(this.activeIndex);
      return true;
    }
    return false;
  };

  Dropdown.prototype._onSelectIndex = function (index) {
    var node = this.nodes[index];
    if (node && node.type === 'item' && this.onSelect) this.onSelect(node);
  };

  Dropdown.prototype.position = function (anchorEl, caretCoords) {
    var scrollY = window.pageYOffset || document.documentElement.scrollTop;
    var scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    // anchorEl may be an opaque adapter target (e.g. an editor instance) with no
    // getBoundingClientRect; it's only used as a fallback when caretCoords is
    // absent, and editor adapters always supply caretCoords.
    var elRect  = (anchorEl && typeof anchorEl.getBoundingClientRect === 'function')
      ? anchorEl.getBoundingClientRect()
      : { top: 0, left: 0, bottom: 0 };

    // Measure size while block but invisible.
    // Restore whatever display the dropdown already had (block when visible,
    // none before first show) — do NOT hardcode 'none', or repositioning on a
    // later keystroke would hide an already-open dropdown.
    var prevDisplay = this.el.style.display;
    this.el.style.transition = 'none';
    this.el.style.display    = 'block';
    this.el.style.visibility = 'hidden';
    var ddH = this.el.offsetHeight;
    var ddW = this.el.offsetWidth;
    this.el.style.display    = prevDisplay;
    this.el.style.visibility = '';
    this.el.style.transition = '';

    var refBottom = caretCoords ? caretCoords.bottom : elRect.bottom;
    var refTop    = caretCoords ? caretCoords.top    : elRect.top;
    var refLeft   = caretCoords ? caretCoords.left   : elRect.left;

    var placement = this.options.placement;
    if (placement === 'auto') {
      placement = (window.innerHeight - refBottom < ddH + 12 && refTop > ddH + 12) ? 'above' : 'below';
    }

    var top, left;
    if (placement === 'above') {
      top = refTop  + scrollY - ddH - 6;
      this.el.classList.add('kfp-dropdown--above');
    } else {
      top = refBottom + scrollY + 6;
      this.el.classList.remove('kfp-dropdown--above');
    }
    left = refLeft + scrollX;

    var maxLeft = scrollX + window.innerWidth - ddW - 8;
    if (left > maxLeft) left = maxLeft;
    if (left < scrollX + 4) left = scrollX + 4;

    this.el.style.top  = Math.round(top)  + 'px';
    this.el.style.left = Math.round(left) + 'px';
  };

  Dropdown.prototype.show = function () {
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    this.el.style.display = 'block';
    void this.el.offsetWidth; // force reflow so CSS transition fires from initial state
    this.el.classList.add('kfp-dropdown--visible');
    this.visible = true;
  };

  Dropdown.prototype.hide = function () {
    var el = this.el;
    el.classList.remove('kfp-dropdown--visible');
    this.visible = false;
    this._hideTimer = setTimeout(function () {
      if (!el.classList.contains('kfp-dropdown--visible')) el.style.display = 'none';
    }, 180);
  };

  Dropdown.prototype.destroy = function () {
    if (this._hideTimer) clearTimeout(this._hideTimer);
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
  };

  // ─── Instance ───────────────────────────────────────────────────────────────

  function Instance(el, userOptions) {
    this.el         = el;
    this.options    = merge(DEFAULTS, userOptions);
    this._inserting = false;
    this._state     = { triggerPos: -1, cursorPos: -1, query: null, active: false };

    this._adapter = adapters[this.options.adapter];
    if (!this._adapter) throw new Error('kFieldPicker: unknown adapter "' + this.options.adapter + '"');

    this._dropdown          = new Dropdown(this.options);
    this._dropdown.onSelect = this._onItemSelect.bind(this);
    this._dropdown.onActiveChange = this._setActiveDescendant.bind(this);
    this._debouncedFetch    = debounce(this._fetchRemote.bind(this), this.options.ajaxDebounce);

    // Ajax/async request bookkeeping — used to drop stale/superseded responses.
    this._ajaxSeq   = 0;
    this._asyncSeq  = 0;
    this._activeXhr = null;

    // ── ARIA: turn the field into a combobox that controls the listbox popup.
    // The element marked up is the adapter's ARIA target (the editable element
    // for editor adapters), defaulting to the field itself. Note: with multiple
    // pickers on one element these single-valued attrs reflect whichever
    // instance acted last; only one popup is open at a time.
    this._ariaEl = this._adapter.getAriaTarget
      ? this._adapter.getAriaTarget(this.el)
      : (this.el && this.el.setAttribute ? this.el : null);
    if (this._ariaEl) {
      this._prevRole = this._ariaEl.getAttribute('role');
      this._ariaEl.setAttribute('role', 'combobox');
      this._ariaEl.setAttribute('aria-autocomplete', 'list');
      this._ariaEl.setAttribute('aria-haspopup', 'listbox');
      this._ariaEl.setAttribute('aria-expanded', 'false');
      this._ariaEl.setAttribute('aria-controls', this._dropdown.el.id);
    }

    var self = this;
    this._reposition = function () {
      if (!self._state.active) return;
      self._dropdown.position(self.el, self._getCaretCoords());
    };

    // Adapters receive _reposition as a 4th arg so they can keep the dropdown
    // pinned to the caret when the editor scrolls its own (possibly iframed)
    // content — which the top-window scroll listener below can't observe.
    this._unbind = this._adapter.bind(
      this.el,
      this._onInput.bind(this),
      this._onKeydown.bind(this),
      this._reposition
    );

    this._onDocClick  = this._onDocumentClick.bind(this);

    this._onScroll = function (e) {
      if (!self._state.active) return;
      // Ignore scrolls originating inside the dropdown's own list — otherwise
      // keyboard nav (scrollIntoView) and wheel-scrolling the list would
      // needlessly reposition.
      if (self._dropdown.el && self._dropdown.el.contains(e.target)) return;
      // Follow the caret as the page or any scrolling container moves.
      self._reposition();
    };
    this._onResize = this._reposition;

    document.addEventListener('mousedown', this._onDocClick);
    // useCapture=true so scrolls of ANY ancestor scrolling container are seen.
    // `scroll` does not bubble, so a non-capturing window listener would miss
    // nested-container scrolls entirely (leaving the dropdown detached). The
    // e.target guard above ignores the dropdown's own internal scroll.
    window.addEventListener('scroll', this._onScroll, true);
    window.addEventListener('resize', this._onResize);
  }

  Instance.prototype._onInput = function () {
    if (this._inserting) return;

    var result = this._adapter.getQuery(this.el, this.options.trigger, this.options.closeChar);
    if (!result) { this._close(); return; }

    this._state.triggerPos = result.triggerPos;
    this._state.cursorPos  = result.cursorPos;
    this._state.query      = result.query;

    if (result.query.length < this.options.minChars) { this._close(); return; }

    if (typeof this.options.items === 'function') {
      this._filterAsync(result.query);
    } else if (this.options.ajaxUrl) {
      this._debouncedFetch(result.query);
    } else {
      this._filterLocal(result.query);
    }
  };

  Instance.prototype._getCaretCoords = function () {
    if (!this._adapter.getCaretCoords) return null;
    try { return this._adapter.getCaretCoords(this.el, this._state.triggerPos); }
    catch (e) { return null; }
  };

  Instance.prototype._filterLocal = function (query) {
    var nodes = buildRenderList(this.options.items, query, this.options);
    this._showResults(nodes, query);
  };

  // `items` as a function(query) → array | Promise<array>. The function does
  // its own filtering, so results are treated as prefiltered. A sequence guard
  // drops stale resolutions if the user keeps typing or closes the picker.
  Instance.prototype._filterAsync = function (query) {
    var self = this;
    var seq  = ++this._asyncSeq;
    var result;
    try { result = this.options.items(query); }
    catch (e) { this._close(); return; }

    if (result && typeof result.then === 'function') {
      this._dropdown.el.classList.add('kfp-dropdown--loading');
      if (!this._state.active) {
        this._dropdown.position(this.el, this._getCaretCoords());
        this._dropdown.show();
      }
      result.then(function (items) {
        if (seq !== self._asyncSeq) return; // superseded — ignore
        self._dropdown.el.classList.remove('kfp-dropdown--loading');
        self._showResults(buildRenderList(items || [], query, self.options, true), query);
      }, function () {
        if (seq !== self._asyncSeq) return;
        self._dropdown.el.classList.remove('kfp-dropdown--loading');
        self._close();
      });
    } else {
      this._showResults(buildRenderList(result || [], query, this.options, true), query);
    }
  };

  Instance.prototype._fetchRemote = function (query) {
    var self    = this;
    var url     = this.options.ajaxUrl;
    var params  = merge({ q: query }, this.options.ajaxParams);
    var qs      = Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
    var fullUrl = url + (url.indexOf('?') >= 0 ? '&' : '?') + qs;

    // Supersede any in-flight request: detach + abort it and bump the sequence
    // so a slow earlier response can never overwrite newer results (race fix).
    this._abortAjax();
    var seq = this._ajaxSeq;

    // Show a loading indicator while waiting for the response.
    // We do NOT set _state.active here — let _showResults handle that
    // once we have real content to display.
    this._dropdown.el.classList.add('kfp-dropdown--loading');
    if (!this._state.active) {
      this._dropdown.position(this.el, this._getCaretCoords());
      this._dropdown.show();
    }

    var xhr = new XMLHttpRequest();
    this._activeXhr = xhr;
    xhr.open('GET', fullUrl, true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (seq !== self._ajaxSeq) return; // superseded by a newer request — ignore
      self._activeXhr = null;
      self._dropdown.el.classList.remove('kfp-dropdown--loading');

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          var data     = JSON.parse(xhr.responseText);
          var rawItems = typeof self.options.ajaxTransform === 'function'
            ? self.options.ajaxTransform(data)
            : (Array.isArray(data) ? data : (data.items || data.results || data.data || []));

          // Always apply client-side filtering so static JSON sources work.
          // If server already filtered by q, all items pass through unchanged.
          var nodes = buildRenderList(rawItems, query, self.options);
          self._showResults(nodes, query);

        } catch (e) {
          console.warn('kFieldPicker: bad ajax response', e);
          if (self.options.ajaxFallback) self._filterLocal(query);
          else self._close();
        }
      } else {
        if (self.options.ajaxFallback) self._filterLocal(query);
        else self._close();
      }
    };
    xhr.send();
  };

  // Cancel any pending debounced fetch and abort the in-flight XHR (detaching
  // its handler first so abort doesn't fire it). Bumps the sequence so any
  // response that slips through is treated as stale.
  Instance.prototype._abortAjax = function () {
    if (this._debouncedFetch && this._debouncedFetch.cancel) this._debouncedFetch.cancel();
    if (this._activeXhr) {
      this._activeXhr.onreadystatechange = null;
      try { this._activeXhr.abort(); } catch (e) {}
      this._activeXhr = null;
    }
    this._ajaxSeq++;
  };

  Instance.prototype._showResults = function (nodes, query) {
    var hasItems = countSelectableItems(nodes) > 0;

    // Close (rather than show an empty state) when nothing matches AND either
    // showNoResults is off, or the query contains a space. A spaced query that
    // matches nothing means the space ended the token — e.g. "Alice J" keeps
    // "Alice Johnson" showing, but "Alice a" (no match) closes the picker.
    if (!hasItems && (!this.options.showNoResults || /\s/.test(query))) {
      this._close();
      if (typeof this.options.onNoResults === 'function') this.options.onNoResults(query);
      return;
    }

    var coords = this._getCaretCoords();
    // Render BEFORE positioning so position() measures the dropdown at its
    // real (new) size — needed for placement:'auto', 'above', and the
    // horizontal clamp, which all depend on the dropdown's dimensions.
    this._dropdown.setNodes(nodes, query);
    this._dropdown.position(this.el, coords);

    if (!this._state.active) {
      this._dropdown.show();
      this._state.active = true;
      if (this._ariaEl) this._ariaEl.setAttribute('aria-expanded', 'true');
      if (typeof this.options.onOpen === 'function') this.options.onOpen(query);
    }

    if (!hasItems && typeof this.options.onNoResults === 'function') {
      this.options.onNoResults(query);
    }
  };

  Instance.prototype._onItemSelect = function (node) {
    var item = { label: node.label, value: node.value, description: node.description, data: node.data, freeText: !!node.freeText };
    var text = this._buildInsertText(item);
    this._inserting = true;
    this._adapter.insert(this.el, text, this._state.triggerPos, this._state.cursorPos);
    this._inserting = false;
    this._close();
    if (typeof this.options.onSelect === 'function') this.options.onSelect(item, text);
  };

  Instance.prototype._buildInsertText = function (item) {
    var trigger = this.options.includeTriggerInInsert ? this.options.trigger : '';
    var space   = this.options.appendSpace ? ' ' : '';
    if (typeof this.options.insertTemplate === 'function') return trigger + this.options.insertTemplate(item) + space;
    if (typeof this.options.insertTemplate === 'string') {
      return trigger + this.options.insertTemplate
        .replace(/\{value\}/g, item.value)
        .replace(/\{label\}/g, item.label) + space;
    }
    return trigger + item.value + space;
  };

  Instance.prototype._onKeydown = function (e) {
    if (!this._state.active) return;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); this._dropdown.moveActive(1);  break;
      case 'ArrowUp':   e.preventDefault(); this._dropdown.moveActive(-1); break;
      case 'Enter':
        if (countSelectableItems(this._dropdown.nodes) > 0) { e.preventDefault(); this._dropdown.selectActive(); }
        break;
      case 'Tab':
        if (this._dropdown.selectActive()) e.preventDefault();
        break;
      case 'Escape': e.preventDefault(); this._close(); break;
    }
  };

  Instance.prototype._onDocumentClick = function (e) {
    if (!this._state.active) return;
    if (e.target === this.el || this._dropdown.el.contains(e.target)) return;
    this._close();
  };

  Instance.prototype._close = function () {
    this._abortAjax();
    this._asyncSeq++; // invalidate any pending async-items resolution
    this._dropdown.el.classList.remove('kfp-dropdown--loading');
    if (this._state.active) {
      this._dropdown.hide();
      this._state.active = false;
      this._state.query  = null;
      if (this._ariaEl) {
        this._ariaEl.setAttribute('aria-expanded', 'false');
        this._ariaEl.removeAttribute('aria-activedescendant');
      }
      if (typeof this.options.onClose === 'function') this.options.onClose();
    }
  };

  // ARIA: keep the field's aria-activedescendant pointing at the active option.
  Instance.prototype._setActiveDescendant = function (optionId) {
    if (!this._ariaEl) return;
    if (optionId) this._ariaEl.setAttribute('aria-activedescendant', optionId);
    else this._ariaEl.removeAttribute('aria-activedescendant');
  };

  Instance.prototype.open          = function () { this._onInput(); };
  Instance.prototype.close         = function () { this._close(); };
  Instance.prototype.updateOptions = function (o) {
    this.options = merge(this.options, o);
    this._dropdown.options = this.options;
  };
  Instance.prototype.destroy = function () {
    this._abortAjax();
    this._unbind();
    document.removeEventListener('mousedown', this._onDocClick);
    window.removeEventListener('scroll', this._onScroll, true);
    window.removeEventListener('resize', this._onResize);
    // Restore the ARIA target's state to how we found it.
    if (this._ariaEl) {
      if (this._prevRole !== null) this._ariaEl.setAttribute('role', this._prevRole);
      else this._ariaEl.removeAttribute('role');
      this._ariaEl.removeAttribute('aria-autocomplete');
      this._ariaEl.removeAttribute('aria-haspopup');
      this._ariaEl.removeAttribute('aria-expanded');
      this._ariaEl.removeAttribute('aria-controls');
      this._ariaEl.removeAttribute('aria-activedescendant');
    }
    this._dropdown.destroy();
  };

  // ─── Public factory ─────────────────────────────────────────────────────────

  function kFieldPicker(target, options) {
    var els = [];
    if (typeof target === 'string')                       els = Array.prototype.slice.call(document.querySelectorAll(target));
    else if (target && target.nodeType === 1)             els = [target];
    else if (target && typeof target.length === 'number') els = Array.prototype.slice.call(target);
    // Opaque target (not a DOM node or array-like): e.g. a rich-text editor
    // instance handled by a custom adapter. Pass it through as a single target.
    else if (target)                                      els = [target];

    var instances = els.map(function (el) {
      var inst = new Instance(el, options || {});
      el._kfpInstances = el._kfpInstances || [];
      el._kfpInstances.push(inst);
      return inst;
    });
    return instances.length === 1 ? instances[0] : instances;
  }

  kFieldPicker.registerAdapter = function (name, adapter) { adapters[name] = adapter; };
  kFieldPicker.adapters = adapters;

  // Helpers for renderItem authors: escape untrusted text, or escape + wrap the
  // query match in <mark class="kfp-highlight"> (same markup as default rows).
  kFieldPicker.escapeHtml = escapeHtml;
  kFieldPicker.highlight = function (text, query, caseSensitive) {
    var safe = escapeHtml(text);
    if (query === '' || query === null || query === undefined) return safe;
    var flags = caseSensitive ? 'g' : 'gi';
    return safe.replace(new RegExp('(' + escapeRegex(escapeHtml(String(query))) + ')', flags),
      '<mark class="kfp-highlight">$1</mark>');
  };

  kFieldPicker.version  = '0.1.9';

  return kFieldPicker;
}));
