document.addEventListener('DOMContentLoaded', function () {

  function setOutput(id, html) {
    var el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '<div class="output__dot"></div><span class="output__text">' + html + '</span>';
    el.classList.add('output--active');
  }

  // ─── 1. Basic ───────────────────────────────────────────────────────────────
  // Multi-word items ('guinea pig', 'sea otter') let you test spaces: typing
  // '#sea o' keeps 'sea otter' showing, while '#sea x' (no match) closes.
  kFieldPicker('#ex-basic', {
    trigger: '#',
    items: ['cat', 'dog', 'mouse', 'rabbit', 'hamster', 'parrot', 'goldfish', 'guinea pig', 'sea otter'],
    appendSpace: false,
    onSelect: function (item) {
      setOutput('ex-basic-out', 'Inserted <code>' + item.value + '</code>');
    },
  });

  // ─── 2. Template fields ─────────────────────────────────────────────────────
  kFieldPicker('#ex-template', {
    trigger: '{{',
    items: [
      { label: 'First Name',   value: 'first_name',  description: 'e.g. Jane' },
      { label: 'Last Name',    value: 'last_name',   description: 'e.g. Smith' },
      { label: 'Email',        value: 'email',       description: 'Primary email' },
      { label: 'Company',      value: 'company',     description: 'Organisation name' },
      { label: 'Phone',        value: 'phone',       description: 'Contact number' },
      { label: "Today's Date", value: 'date_today',  description: 'Inserted at send time' },
    ],
    insertTemplate: function (item) { return '{{' + item.value + '}}'; },
    appendSpace: true,
    onSelect: function (item) {
      setOutput('ex-template-out', 'Inserted <code>&#123;&#123;' + item.value + '&#125;&#125;</code>');
    },
  });

  // ─── 3. @mentions ───────────────────────────────────────────────────────────
  kFieldPicker('#ex-mentions', {
    trigger: '@',
    items: [
      { label: 'Alice Johnson', value: 'alice', description: 'Product Design' },
      { label: 'Bob Martin',    value: 'bob',   description: 'Engineering' },
      { label: 'Carol White',   value: 'carol', description: 'Marketing' },
      { label: 'David Lee',     value: 'david', description: 'Sales' },
      { label: 'Eva Chen',      value: 'eva',   description: 'Customer Success' },
      { label: 'Frank Torres',  value: 'frank', description: 'Finance' },
    ],
    insertTemplate: '@{value}',
    appendSpace: true,
    maxResults: 5,
    allowFreeText: true,     // mention someone who isn't in the list
    freeTextLabel: 'Mention',
    onSelect: function (item) {
      if (item.freeText) {
        setOutput('ex-mentions-out', 'Mentioned <code>@' + item.value + '</code> — free text');
      } else {
        setOutput('ex-mentions-out', 'Mentioned <code>@' + item.value + '</code> — ' + item.label);
      }
    },
  });

  // ─── 4. Grouped / nested items ──────────────────────────────────────────────
  kFieldPicker('#ex-grouped', {
    trigger: '#',
    items: [
      {
        group: 'Contact',
        children: [
          {
            group: 'Personal',
            children: [
              { label: 'First Name',  value: 'first_name',  description: 'e.g. Jane' },
              { label: 'Last Name',   value: 'last_name',   description: 'e.g. Smith' },
              { label: 'Email',       value: 'email',       description: 'Personal email' },
              { label: 'Phone',       value: 'phone',       description: 'Mobile number' },
            ],
          },
          {
            group: 'Work',
            children: [
              { label: 'Company',     value: 'company',     description: 'Organisation name' },
              { label: 'Job Title',   value: 'job_title',   description: 'Role or position' },
              { label: 'Work Email',  value: 'work_email',  description: 'Work email address' },
            ],
          },
        ],
      },
      {
        group: 'Invoice',
        children: [
          { label: 'Invoice Date',  value: 'invoice_date',  description: 'Date of invoice' },
          { label: 'Due Date',      value: 'due_date',      description: 'Payment due by' },
          { label: 'Total Amount',  value: 'total_amount',  description: 'Amount due' },
          { label: 'Currency',      value: 'currency',      description: 'e.g. GBP' },
          { label: 'Order Ref',     value: 'order_ref',     description: 'Order reference' },
        ],
      },
      {
        group: 'Support',
        children: [
          { label: 'Ticket Number', value: 'ticket_number', description: 'Support ticket ID' },
          { label: 'Agent Name',    value: 'agent_name',    description: 'Assigned agent' },
          { label: 'Priority',      value: 'priority',      description: 'Ticket priority' },
        ],
      },
    ],
    insertTemplate: '{{value}}',
    appendSpace: true,
    maxResults: false,   // unlimited — show every match, no cap
    onSelect: function (item) {
      setOutput('ex-grouped-out', 'Inserted <code>&#123;&#123;' + item.value + '&#125;&#125;</code> — ' + item.label);
    },
  });

  // ─── 5. Remote / Ajax ───────────────────────────────────────────────────────
  // examples.json is a static file, so client-side filtering is needed.
  // kFieldPicker always applies buildRenderList() filtering after ajaxTransform,
  // so this just works — no extra config needed.
  kFieldPicker('#ex-remote', {
    trigger: '#',
    ajaxUrl: './examples.json',
    ajaxDebounce: 300,
    ajaxTransform: function (data) { return data.items; },
    insertTemplate: '{{value}}',
    appendSpace: true,
    maxResults: 8,
    highlightMatch: true,
    showNoResults: true,
    noResultsText: 'No fields match.',
    onSelect: function (item) {
      setOutput('ex-remote-out', 'Inserted <code>&#123;&#123;' + item.value + '&#125;&#125;</code> — ' + item.label);
    },
  });

  // ─── 6. Dark / Markdown ─────────────────────────────────────────────────────
  kFieldPicker('#ex-dark', {
    trigger: '/',
    items: [
      { label: '/bold',    value: '**bold**',        description: 'Make text bold' },
      { label: '/italic',  value: '*italic*',        description: 'Italicise text' },
      { label: '/code',    value: '`code`',          description: 'Inline code' },
      { label: '/link',    value: '[text](url)',     description: 'Insert a link' },
      { label: '/heading', value: '## Heading',      description: 'H2 heading' },
      { label: '/list',    value: '- item\n- item',  description: 'Bullet list' },
      { label: '/todo',    value: '- [ ] ',          description: 'Todo checkbox' },
    ],
    includeTriggerInInsert: false,
    appendSpace: false,
    dropdownClass: 'kfp-dark',
    highlightMatch: true,
    onSelect: function (item) {
      setOutput('ex-dark-out', 'Inserted <code>' + item.label + '</code>');
    },
  });

  // ─── 7. Slash commands ──────────────────────────────────────────────────────
  kFieldPicker('#ex-slash', {
    trigger: '/',
    minChars: 1,
    maxResults: 6,
    // Values omit the leading '/'; includeTriggerInInsert re-adds the typed
    // trigger on insert, so selecting 'close' inserts '/close' (not '//close').
    items: [
      { label: 'Assign to me',    value: 'assign',    description: 'Assign this ticket to yourself' },
      { label: 'Close issue',     value: 'close',     description: 'Close this issue' },
      { label: 'Reopen issue',    value: 'reopen',    description: 'Reopen a closed issue' },
      { label: 'Add label',       value: 'label',     description: 'Tag this issue' },
      { label: 'Set milestone',   value: 'milestone', description: 'Link to a milestone' },
      { label: 'Set priority',    value: 'priority',  description: 'Change priority level' },
      { label: 'Duplicate issue', value: 'duplicate', description: 'Mark as duplicate of...' },
      { label: 'Move to project', value: 'move',      description: 'Move to another project' },
    ],
    includeTriggerInInsert: true,
    appendSpace: true,
    noResultsText: 'Unknown command.',
    onSelect: function (item) {
      setOutput('ex-slash-out', 'Command <code>/' + item.value + '</code>');
    },
  });

  // ─── 8. TinyMCE rich-text editor (custom adapter) ───────────────────────────
  // Requires tinymce + kFieldPicker.tinymce.js (loaded in index.html).
  if (window.tinymce) {
    tinymce.init({
      selector: '#ex-tinymce',
      license_key: 'gpl',           // use under the GPL — suppresses the cloud notice
      menubar: false,
      toolbar: 'bold italic | bullist numlist',
      statusbar: false,
      promotion: false,
      height: 200,
      setup: function (editor) {
        editor.on('init', function () {
          kFieldPicker(editor, {
            adapter: 'tinymce',
            trigger: '@',
            items: [
              { label: 'Alice Johnson', value: 'alice', description: 'Product Design' },
              { label: 'Bob Martin',    value: 'bob',   description: 'Engineering' },
              { label: 'Carol White',   value: 'carol', description: 'Marketing' },
              { label: 'David Lee',     value: 'david', description: 'Sales' },
              { label: 'Eva Chen',      value: 'eva',   description: 'Customer Success' },
            ],
            insertTemplate: '@{value}',
            allowFreeText: true,
            freeTextLabel: 'Mention',
            onSelect: function (item) {
              setOutput('ex-tinymce-out',
                (item.freeText ? 'Mentioned (free text) ' : 'Mentioned ') + '<code>@' + item.value + '</code>');
            },
          });
        });
      },
    });
  }

  // ─── 9. Async items + custom renderItem ─────────────────────────────────────
  // `items` is a function returning a Promise (simulated 220ms fetch). It does
  // its own filtering (here: starts-with). renderItem draws a rich row using the
  // kFieldPicker.highlight / escapeHtml helpers.
  var LANGUAGES = [
    { label: 'JavaScript', value: 'js',     description: 'Runs everywhere',   data: { emoji: '🟨' } },
    { label: 'Python',     value: 'py',     description: 'Data & scripting',  data: { emoji: '🐍' } },
    { label: 'Rust',       value: 'rs',     description: 'Memory-safe & fast',data: { emoji: '🦀' } },
    { label: 'Go',         value: 'go',     description: 'Simple concurrency',data: { emoji: '🐹' } },
    { label: 'Ruby',       value: 'rb',     description: 'Developer happiness',data:{ emoji: '💎' } },
    { label: 'Swift',      value: 'swift',  description: 'Apple platforms',   data: { emoji: '🕊️' } },
    { label: 'TypeScript', value: 'ts',     description: 'Typed JavaScript',  data: { emoji: '🔷' } },
  ];
  kFieldPicker('#ex-async', {
    trigger: '#',
    minChars: 1,
    items: function (query) {
      // Pretend this hits an API; resolve after a short delay so the spinner shows.
      return new Promise(function (resolve) {
        setTimeout(function () {
          var q = query.toLowerCase();
          resolve(LANGUAGES.filter(function (l) { return l.label.toLowerCase().indexOf(q) === 0; }));
        }, 220);
      });
    },
    allowFreeText: true,
    renderItem: function (item, query) {
      if (item.freeText) {
        return '<div style="display:flex;align-items:center;gap:9px;padding:7px 10px;flex:1;min-width:0;opacity:.85">' +
                 '<span style="font-size:15px">🔎</span><span>Search for “' + kFieldPicker.escapeHtml(item.label) + '”</span></div>';
      }
      var emoji = (item.data && item.data.emoji) || '•';
      return '<div style="display:flex;align-items:center;gap:9px;padding:7px 10px;flex:1;min-width:0">' +
               '<span style="font-size:16px;width:20px;text-align:center">' + emoji + '</span>' +
               '<span style="flex:1;min-width:0">' +
                 '<span style="display:block">' + kFieldPicker.highlight(item.label, query) + '</span>' +
                 (item.description ? '<span style="display:block;font-size:11.5px;color:var(--kfp-desc-color)">' + kFieldPicker.escapeHtml(item.description) + '</span>' : '') +
               '</span></div>';
    },
    onSelect: function (item) {
      setOutput('ex-async-out', (item.freeText ? 'Searched ' : 'Picked ') + '<code>' + item.value + '</code> — ' + item.label);
    },
  });

  // ─── 10. TinyMCE — attach after init (decoupled) ────────────────────────────
  // The picker does NOT have to be wired inside tinymce.init's `setup`. Here the
  // init config and the kFieldPicker call are completely separate, and the attach
  // code makes NO assumptions about timing — it tolerates running before the
  // TinyMCE library has even loaded (slow CDN), before tinymce.init is called,
  // and before the editor finishes initializing. Note there's no `if
  // (window.tinymce)` guard: the helpers wait for whatever isn't ready yet.

  // Wait for the TinyMCE library global itself. The CDN <script> may still be in
  // flight (especially if loaded async/deferred), so poll until it appears.
  // Resolves immediately when it's already present. Gives up after ~10s so a
  // dead CDN doesn't poll forever.
  var whenTinyMCE = function (cb) {
    if (window.tinymce) { cb(window.tinymce); return; }
    var tries = 0;
    var poll = setInterval(function () {
      if (window.tinymce) { clearInterval(poll); cb(window.tinymce); }
      else if (++tries > 200) clearInterval(poll);   // ~10s — CDN unreachable, stop
    }, 50);
  };

  // Attach the picker as soon as everything it needs exists: (1) the library,
  // (2) the editor instance, (3) that editor's init. Each step waits if needed.
  var attachPickerWhenReady = function (id, opts) {
    whenTinyMCE(function (tinymce) {
      function whenInitialized(editor) {
        if (editor.initialized) kFieldPicker(editor, opts);          // already ready
        else editor.on('init', function () { kFieldPicker(editor, opts); }); // wait for it
      }
      var existing = tinymce.get(id);          // null until init registers the editor
      if (existing) { whenInitialized(existing); return; }
      tinymce.on('AddEditor', function handler(e) {                  // not created yet — wait
        if (e.editor.id !== id) return;        // ignore other editors (e.g. card 08)
        tinymce.off('AddEditor', handler);     // got ours — stop listening
        whenInitialized(e.editor);
      });
    });
  };

  // Queue the picker first — proving it tolerates the library/init/editor not
  // being ready yet. The tinymce.init() below stays an entirely separate concern
  // (also deferred until the library loads, since the demo owns that call too).
  attachPickerWhenReady('ex-tinymce-after', {
    adapter: 'tinymce',
    trigger: '{{',
    items: [
      { label: 'First Name', value: 'first_name' },
      { label: 'Last Name',  value: 'last_name' },
      { label: 'Company',    value: 'company' },
      { label: 'Email',      value: 'email' },
    ],
    insertTemplate: '{{value}}',
    onSelect: function (item) {
      setOutput('ex-tinymce-after-out', 'Inserted <code>&#123;&#123;' + item.value + '&#125;&#125;</code>');
    },
  });

  whenTinyMCE(function (tinymce) {
    tinymce.init({
      selector: '#ex-tinymce-after',
      license_key: 'gpl',
      menubar: false,
      toolbar: 'bold italic | bullist numlist',
      statusbar: false,
      promotion: false,
      height: 200,
    });
  });

  // ─── 11. Template trigger (#value#) ─────────────────────────────────────────
  // Triggered by '#', inserts a #value# token via insertTemplate — pick "cat" and
  // "#cat#" lands in the field. Because the trigger '#' also CLOSES the token,
  // closeChar: '#' tells the picker the delimiter is symmetric: a completed #cat#
  // is recognised as closed, so typing after it (#cat#TEST) won't re-open, and the
  // picker only fires on a fresh '#'. Multi-word items ('guinea pig', 'sea otter')
  // are searchable too — '#sea o' keeps "sea otter" showing and inserts
  // "#sea otter#"; for a symmetric delimiter a '#' typed after a space starts a
  // fresh token, so '#cat #se' still opens a new picker for "se".
  kFieldPicker('#ex-basic-template', {
    trigger: '#',
    closeChar: '#',
    items: ['cat', 'dog', 'mouse', 'rabbit', 'hamster', 'parrot', 'goldfish', 'guinea pig', 'sea otter'],
    insertTemplate: '#{value}#',
    onSelect: function (item) {
      setOutput('ex-basic-template-out', 'Inserted <code>#' + item.value + '#</code>');
    },
  });

});
