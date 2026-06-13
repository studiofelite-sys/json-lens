/**
 * Renders a parsed JSON value as a collapsible, filterable tree.
 *
 * Rows are rendered flat (one <div> per line) rather than as nested DOM. That
 * keeps collapse/expand and filtering to a single pass over an array instead of
 * a recursive DOM walk, which matters once a document runs to tens of thousands
 * of nodes.
 */
(function (global) {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function classOf(v) {
    if (v === null) return 'z';
    if (typeof v === 'string') return 's';
    if (typeof v === 'number') return 'n';
    if (typeof v === 'boolean') return 'b';
    return 'p';
  }

  function renderScalar(v) {
    if (typeof v === 'string') return `<span class="s">"${esc(v)}"</span>`;
    if (v === null) return '<span class="z">null</span>';
    return `<span class="${classOf(v)}">${esc(String(v))}</span>`;
  }

  /** Flatten a value into an ordered list of display rows. */
  function flatten(value) {
    const rows = [];

    function push(depth, key, val, parentPath, isLast) {
      const path = key === null
        ? '$'
        : parentPath + (typeof key === 'number' ? `[${key}]` : `.${key}`);

      const container = val !== null && typeof val === 'object';
      const entries = container ? (Array.isArray(val) ? val.map((v, i) => [i, v]) : Object.entries(val)) : [];
      const index = rows.length;
      const label = key === null
        ? ''
        : typeof key === 'number'
          ? `<span class="p">${key}:</span> `
          : `<span class="k">"${esc(key)}"</span><span class="p">:</span> `;

      let body;
      if (!container) {
        body = renderScalar(val);
      } else if (Array.isArray(val)) {
        body = `<span class="p">[</span><span class="count"> ${entries.length} item${entries.length === 1 ? '' : 's'} </span><span class="p">]</span>`;
      } else {
        body = `<span class="p">{</span><span class="count"> ${entries.length} key${entries.length === 1 ? '' : 's'} </span><span class="p">}</span>`;
      }

      rows.push({
        depth,
        container,
        path,
        html: label + body,
        text: (key === null ? '' : String(key)) + ' ' + (container ? '' : String(val)),
        childCount: 0,
        collapsed: depth > 2,
        comma: !isLast,
      });

      entries.forEach(([k, v], n) => push(depth + 1, k, v, path, n === entries.length - 1));
      rows[index].childCount = rows.length - index - 1;
    }

    push(0, null, value, '', true);
    return rows;
  }

  function Tree(container) {
    let rows = [];
    let filter = '';

    function paint() {
      const needle = filter.trim().toLowerCase();
      const parts = [];
      let skipUntilDepth = null;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        if (skipUntilDepth !== null) {
          if (row.depth > skipUntilDepth) continue;
          skipUntilDepth = null;
        }

        const matched = needle && row.text.toLowerCase().includes(needle);
        if (needle && !matched && !row.container) continue;

        const toggle = row.container && row.childCount
          ? `<span class="toggle" data-i="${i}">${row.collapsed ? '▸' : '▾'}</span>`
          : '<span class="toggle leaf"> </span>';

        parts.push(
          `<div class="row${matched ? ' match' : ''}" data-i="${i}" title="${esc(row.path)}">` +
          '  '.repeat(row.depth) + toggle + row.html + (row.comma ? '<span class="p">,</span>' : '') +
          '</div>'
        );

        if (row.collapsed && row.container) skipUntilDepth = row.depth;
      }

      container.innerHTML = parts.join('') || '<div class="row p">No matching rows.</div>';
    }

    container.addEventListener('click', (e) => {
      const toggle = e.target.closest('.toggle:not(.leaf)');
      if (!toggle) return;
      const row = rows[Number(toggle.dataset.i)];
      row.collapsed = !row.collapsed;
      paint();
    });

    return {
      load(value) {
        rows = flatten(value);
        paint();
      },
      clear() {
        rows = [];
        container.innerHTML = '';
      },
      setFilter(value) {
        filter = value;
        paint();
      },
      expandAll() {
        rows.forEach((r) => { r.collapsed = false; });
        paint();
      },
      collapseAll() {
        rows.forEach((r) => { r.collapsed = r.depth > 0; });
        paint();
      },
    };
  }

  global.JSONLensTree = Tree;
})(window);
