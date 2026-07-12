# JSON Lens

A fast, offline-first JSON formatter, validator and tree explorer that runs entirely in the browser. Nothing is uploaded anywhere — paste a payload from a production log and it never leaves the tab.

**Live:** https://studiofelite-sys.github.io/json-lens/

## Why another JSON formatter

Most of them wrap `JSON.parse` and surface whatever the engine happened to say. `Unexpected token } in JSON at position 3184` is not a useful thing to read at 2am. JSON Lens ships its own recursive-descent parser (`js/parser.js`, ~180 lines, no dependencies) so it can tell you:

```
Line 94, column 17: Trailing comma before }
    "retries": 3,
                ^
```

It also names the mistakes people actually make — single-quoted strings, unescaped newlines inside strings, malformed `\u` escapes, trailing commas — instead of reporting them as a generic syntax error.

## Features

- **Precise errors** — line, column and a caret excerpt for every parse failure.
- **Collapsible tree** — rendered as a flat row list, so collapse and filter stay fast on documents with tens of thousands of nodes.
- **Key/value filter** — type in the filter box to narrow the tree.
- **Format / minify** with 2-space, 4-space or tab indentation.
- **Shape stats** — node count, object/array counts, nesting depth, byte size, parse time.
- **Shareable links** — `?json=<uri-encoded>` loads a document straight into the editor.
- **Light and dark** — follows your system theme.

## Keyboard

| Shortcut | Action |
| --- | --- |
| `Ctrl` / `Cmd` + `Enter` | Format |

## Running locally

There is no build step and no dependencies. Serve the folder with anything:

```bash
git clone https://github.com/studiofelite-sys/json-lens.git
cd json-lens
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly off the filesystem works too, though the clipboard button needs a real origin in some browsers.

## Project layout

```
index.html      markup and layout
css/style.css   theming via custom properties
js/parser.js    the JSON parser and document statistics
js/tree.js      flat-row tree renderer, collapse and filter
js/app.js       wiring, status bar, keyboard, share links
```

## License

MIT — see [LICENSE](LICENSE).
