# kFieldPicker

A lightweight, zero-dependency JavaScript plugin that adds a searchable dropdown
picker to any `<input>` or `<textarea>`. Type a configurable trigger character (or
sequence), filter a list of items as you type, and select one to insert it at the
caret.

It powers @mentions, `{{merge_field}}` template insertion, `/slash` commands,
grouped/nested item lists, remote (ajax) sources, async item functions, and custom
row rendering — all with no build step and no runtime dependencies.

[Examples and Docs](https://kastrack.github.io/kFieldPicker/)

**Current version: 0.1**

---

## Features

- **Zero dependencies** — plain ES5 + CSS, works without transpilation.
- **No build step** — drop in two files and go (minified versions included).
- **Any trigger** — single character (`@`, `#`, `/`) or multi-char (`{{`).
- **Flexible items** — strings, objects, infinitely nestable groups, ajax, or an
  async function returning a `Promise`.
- **Insert templates** — control exactly what gets inserted (`{{value}}`, `@{value}`, …).
- **Free text** — let users insert what they typed even if it isn't in the list.
- **Custom rendering** — `renderItem` for rich rows (icons, highlighting, descriptions).
- **Accessible** — ARIA combobox roles, full keyboard navigation.
- **Theme-able** — every visual value is a CSS custom property; built-in dark theme.
- **Editor adapters** — drives plain inputs out of the box; optional TinyMCE adapter.

---

## Installation

Include the CSS and JS — that's it. Use the minified builds in production:

```html
<link rel="stylesheet" href="kFieldPicker.min.css">

<!-- before </body> -->
<script src="kFieldPicker.min.js"></script>
```

The unminified `kFieldPicker.css` / `kFieldPicker.js` are also shipped for
development and reading.

### CommonJS / AMD

The core ships with a UMD wrapper:

```js
const kFieldPicker = require('kfieldpicker');
// or: import kFieldPicker from 'kfieldpicker';
```

---

## Quick Start

```js
kFieldPicker('#my-input', {
  trigger: '#',
  items: ['cat', 'dog', 'mouse'],
});
```

Typing `#` opens the dropdown. **Arrow keys** navigate, **Enter/Tab** selects,
**Escape** closes.

The factory accepts a CSS selector, a DOM element, or a NodeList/array of elements.
It returns a single `Instance` when one element matched, or an array of `Instance`s
otherwise.

---

## Common Recipes

**@mentions**

```js
kFieldPicker('#comment', {
  trigger: '@',
  items: [
    { label: 'Alice Johnson', value: 'alice', description: 'Product Design' },
    { label: 'Bob Martin',    value: 'bob',   description: 'Engineering' },
  ],
  insertTemplate: '@{value}',
  allowFreeText: true,        // mention someone not in the list
});
```

**Template / merge fields**

```js
kFieldPicker('#email', {
  trigger: '{{',
  items: [{ label: 'First Name', value: 'first_name' }],
  insertTemplate: '{{value}}',
});
```

**Slash commands** — note the values omit the trigger, because
`includeTriggerInInsert` re-adds it:

```js
kFieldPicker('#composer', {
  trigger: '/',
  minChars: 1,
  items: [{ label: 'Close issue', value: 'close' }],
  includeTriggerInInsert: true,   // inserts "/close", not "//close"
});
```

**Grouped / nested items** — `{ group, children }`, nestable to any depth:

```js
items: [
  {
    group: 'Contact',
    children: [
      { group: 'Personal', children: [
        { label: 'First Name', value: 'first_name' },
        { label: 'Email',      value: 'email' },
      ] },
      { label: 'Company', value: 'company' },   // leaf at group level
    ],
  },
]
```

Group headers are non-selectable, skipped during keyboard nav, and auto-hidden when
none of their children match. `maxResults` counts leaf items only.

**Remote (ajax) source** — `?q=` is appended to the URL; results are filtered
client-side automatically, so static JSON files work without a smart backend:

```js
kFieldPicker('#search', {
  trigger: '#',
  ajaxUrl: '/api/fields',
  ajaxDebounce: 300,
  ajaxTransform: function (data) { return data.items; },
});
```

**Async items** — a function returning an array or a `Promise` for fully custom
(fuzzy/ranked/remote) filtering, with a loading spinner. Results are treated as
already filtered:

```js
kFieldPicker('#lang', {
  trigger: '#',
  minChars: 1,
  items: function (query) {
    return fetch('/api?q=' + query).then(function (r) { return r.json(); });
  },
});
```

**Custom rendering** — `renderItem(item, query)` returns an HTML string or DOM node
(a falsy return falls back to the default row). Use the exposed helpers for safe
strings:

```js
renderItem: function (item, query) {
  return '<span>' + kFieldPicker.highlight(item.label, query) + '</span>';
}
```

**Dark theme**

```js
kFieldPicker('#notes', { trigger: '/', dropdownClass: 'kfp-dark' });
```

---

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `trigger` | string | `"#"` | Character(s) that open the picker. Multi-char works (`"{{"`). |
| `items` | array \| function | `[]` | Static items (strings/objects/groups), or `function(query)` → array \| `Promise`. |
| `ajaxUrl` | string \| null | `null` | Remote source URL. `?q=` is appended. |
| `ajaxDebounce` | number | `300` | Debounce delay (ms) before ajax fires. |
| `ajaxParams` | object | `{}` | Extra params appended to every ajax request. |
| `ajaxTransform` | function \| null | `null` | Maps raw ajax response → items array (flat or nested). |
| `ajaxFallback` | boolean | `false` | Fall back to local `items` if ajax fails. |
| `minChars` | number | `0` | Min chars after trigger before showing results. |
| `maxResults` | number | `10` | Max leaf items shown (group headers don't count). |
| `caseSensitive` | boolean | `false` | Case-sensitive filtering. |
| `insertTemplate` | string \| function \| null | `null` | Controls inserted text (`'{{value}}'`, or `function(item)`). |
| `includeTriggerInInsert` | boolean | `false` | Prepend the trigger char to inserted text. |
| `appendSpace` | boolean | `true` | Append a space after inserted text. |
| `noResultsText` | string | `"No results found"` | Empty-state message. |
| `showNoResults` | boolean | `true` | Show empty-state vs. close the dropdown. |
| `highlightMatch` | boolean | `true` | Bold the matching portion of labels. |
| `renderItem` | function \| null | `null` | Custom row renderer `(item, query)` → HTML string \| DOM node. |
| `allowFreeText` | boolean | `false` | Offer the raw query as a selectable item; selection carries `freeText: true`. |
| `freeTextLabel` | string | `"Add"` | Badge text on the free-text row (`""` hides it). |
| `dropdownClass` | string | `""` | Extra CSS class on the dropdown. `"kfp-dark"` for dark theme. |
| `placement` | string | `"auto"` | `"auto"`, `"below"`, or `"above"`. |
| `adapter` | string | `"input"` | Adapter name (e.g. `"tinymce"`). |
| `onOpen` | function \| null | `null` | Called when the dropdown opens. Receives `(query)`. |
| `onClose` | function \| null | `null` | Called when the dropdown closes. |
| `onSelect` | function \| null | `null` | Called on selection. Receives `(item, insertedText)`. |
| `onNoResults` | function \| null | `null` | Called when the filtered list is empty. Receives `(query)`. |

### Item formats

```js
'cat'                                              // plain string
{ label: 'First Name', value: 'first_name' }       // object
{ label: 'Email', value: 'email', description: 'Primary email', data: {…} }
{ group: 'Contact', children: [ … ] }              // group (nestable)
```

> **Gotcha:** when `includeTriggerInInsert: true`, your item `value` (or
> `insertTemplate` output) should **not** already include the trigger character —
> otherwise it doubles (e.g. `//close`).

---

## API

```js
var picker = kFieldPicker('#input', { trigger: '@', items: [...] });

picker.open();              // open the dropdown programmatically
picker.close();             // close it
picker.updateOptions({ maxResults: 5 });   // merge in new options
picker.destroy();           // unbind events, remove DOM, restore the element
```

**Statics**

```js
kFieldPicker.version                         // '0.1'
kFieldPicker.registerAdapter(name, adapter)  // register a custom editor adapter
kFieldPicker.adapters                         // the adapter registry
kFieldPicker.escapeHtml(str)                  // HTML-escape a string
kFieldPicker.highlight(text, query, caseSensitive?)  // escape + wrap match in <mark>
```

---

## TinyMCE adapter (optional)

`kFieldPicker.tinymce.js` registers a `tinymce` adapter so the picker can drive a
TinyMCE 5+ editor (iframe or inline). Load it **after** `kFieldPicker.js` and
TinyMCE, then pass `adapter: 'tinymce'` and the editor instance as the target:

```html
<script src="kFieldPicker.min.js"></script>
<script src="kFieldPicker.tinymce.min.js"></script>
```

```js
editor.on('init', function () {
  kFieldPicker(editor, { adapter: 'tinymce', trigger: '@', items: [...] });
});
```

---

## Theming

Every visual value is a CSS custom property (`--kfp-*`) — override them in your own
CSS to restyle the dropdown. The bundled `.kfp-dark` class provides a ready-made
dark theme via `dropdownClass: 'kfp-dark'`.

---

## Project layout

| File | Purpose |
|---|---|
| `kFieldPicker.js` / `.css` | Core plugin — the only two required files. |
| `kFieldPicker.tinymce.js` | Optional TinyMCE adapter add-on. |
| `kFieldPicker.min.*` | Minified builds (generated by `build.sh`). |
| `build.sh` | Regenerates the `*.min.*` assets (needs `terser` + `cleancss`). |
| `index.html` | Live examples page. |
| `docs.html` | Full documentation. |
| `examples.js` / `examples.css` / `examples.json` | Examples page wiring, styles, ajax data. |
| `examples-source.js` | Populates the "View source" panel on each example card. |

### Building the minified assets

The `*.min.*` files are build artifacts — never hand-edit them. Edit the source,
then run:

```sh
./build.sh
```

This requires [`terser`](https://github.com/terser/terser) (JS) and
[`clean-css-cli`](https://github.com/clean-css/clean-css-cli) (CSS) on your `PATH`:

```sh
npm i -g terser clean-css-cli
```

### Running the examples locally

The ajax example and the "View source" panels fetch files over HTTP, so they won't
work from a `file://` URL. Serve the directory:

```sh
python3 -m http.server 8080
# or: npx serve .
```

Then open <http://localhost:8080/index.html>.

---

## Browser support

Modern evergreen browsers. The core is written in ES5 (no `const`/`let`/arrow
functions/classes) and has no dependencies. The "View source" panels and ajax
examples use `fetch`, and the TinyMCE adapter requires TinyMCE 5+.
