(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const input = $('input');
  const status = $('status');
  const tree = window.JSONLensTree($('tree'));
  const { parse, stats } = window.JSONLensParser;

  const SAMPLE = {
    service: 'orders-api',
    version: '2.4.1',
    healthy: true,
    replicas: 3,
    endpoints: [
      { path: '/orders', methods: ['GET', 'POST'], auth: 'bearer', p95_ms: 42 },
      { path: '/orders/{id}', methods: ['GET', 'PATCH', 'DELETE'], auth: 'bearer', p95_ms: 18 },
      { path: '/healthz', methods: ['GET'], auth: null, p95_ms: 2 },
    ],
    limits: { rps: 500, burst: 750, payload_bytes: 1048576 },
    deployed_at: '2026-03-11T09:14:22Z',
  };

  let debounce;

  function setStatus(text, kind) {
    status.textContent = text;
    status.className = 'status' + (kind ? ' ' + kind : '');
  }

  function indentValue() {
    const raw = $('indent').value;
    return raw === '\\t' ? '\t' : Number(raw);
  }

  function bytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }

  function run() {
    const text = input.value;
    if (!text.trim()) {
      tree.clear();
      setStatus('Ready.');
      return null;
    }
    try {
      const started = performance.now();
      const value = parse(text);
      const elapsed = performance.now() - started;
      const s = stats(value);
      tree.load(value);
      setStatus(
        `Valid · ${s.nodes} nodes · ${s.objects} objects · ${s.arrays} arrays · ` +
        `depth ${s.depth} · ${bytes(new Blob([text]).size)} · parsed in ${elapsed.toFixed(1)}ms`,
        'ok'
      );
      return value;
    } catch (err) {
      tree.clear();
      if (err.name === 'JSONParseError') {
        setStatus(`Line ${err.line}, column ${err.column}: ${err.message}\n${err.excerpt}`, 'err');
      } else {
        setStatus(err.message, 'err');
      }
      return null;
    }
  }

  function reformat(spacing) {
    const value = run();
    if (value === null) return;
    input.value = JSON.stringify(value, null, spacing);
    run();
  }

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(run, 180);
  });

  $('btn-format').addEventListener('click', () => reformat(indentValue()));
  $('btn-minify').addEventListener('click', () => reformat(0));
  $('indent').addEventListener('change', () => reformat(indentValue()));

  $('btn-sample').addEventListener('click', () => {
    input.value = JSON.stringify(SAMPLE, null, 2);
    run();
  });

  $('btn-clear').addEventListener('click', () => {
    input.value = '';
    run();
    input.focus();
  });

  $('btn-copy').addEventListener('click', async () => {
    if (!input.value) return;
    try {
      await navigator.clipboard.writeText(input.value);
      setStatus('Copied to clipboard.', 'ok');
    } catch {
      setStatus('Clipboard blocked by the browser — select and copy manually.', 'err');
    }
  });

  $('btn-expand').addEventListener('click', () => tree.expandAll());
  $('btn-collapse').addEventListener('click', () => tree.collapseAll());
  $('filter').addEventListener('input', (e) => tree.setFilter(e.target.value));

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      reformat(indentValue());
    }
  });

  // Allow ?json=<encoded> so a formatted document can be shared as a link.
  const shared = new URLSearchParams(location.search).get('json');
  input.value = shared ? decodeURIComponent(shared) : JSON.stringify(SAMPLE, null, 2);
  run();
})();
