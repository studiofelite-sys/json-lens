/**
 * A small hand-written JSON parser.
 *
 * The browser already ships JSON.parse, but its error messages differ between
 * engines and rarely tell you *where* the problem is in a useful way. This
 * parser reports an exact line/column plus a caret excerpt, which is the whole
 * reason JSON Lens exists.
 */
(function (global) {
  'use strict';

  function ParseError(message, index, line, column, source) {
    const err = new Error(message);
    err.name = 'JSONParseError';
    err.index = index;
    err.line = line;
    err.column = column;
    err.excerpt = excerptAt(source, line, column);
    return err;
  }

  function excerptAt(source, line, column) {
    const lines = source.split('\n');
    const text = lines[line - 1] || '';
    const trimmedStart = Math.max(0, column - 40);
    const shown = text.slice(trimmedStart, trimmedStart + 80);
    const caretCol = column - trimmedStart - 1;
    return shown + '\n' + ' '.repeat(Math.max(0, caretCol)) + '^';
  }

  function parse(source) {
    let i = 0;
    let line = 1;
    let lineStart = 0;

    function column() {
      return i - lineStart + 1;
    }

    function fail(message) {
      throw ParseError(message, i, line, column(), source);
    }

    function advance(n) {
      for (let k = 0; k < n; k++) {
        if (source[i] === '\n') {
          line++;
          lineStart = i + 1;
        }
        i++;
      }
    }

    function skipWhitespace() {
      while (i < source.length && /[ \t\n\r]/.test(source[i])) advance(1);
    }

    function expect(ch) {
      if (source[i] !== ch) {
        fail(`Expected '${ch}' but found ${source[i] === undefined ? 'end of input' : `'${source[i]}'`}`);
      }
      advance(1);
    }

    function parseValue() {
      skipWhitespace();
      const ch = source[i];
      if (ch === undefined) fail('Unexpected end of input');
      if (ch === '{') return parseObject();
      if (ch === '[') return parseArray();
      if (ch === '"') return parseString();
      if (ch === '-' || (ch >= '0' && ch <= '9')) return parseNumber();
      if (source.startsWith('true', i)) { advance(4); return true; }
      if (source.startsWith('false', i)) { advance(5); return false; }
      if (source.startsWith('null', i)) { advance(4); return null; }
      if (ch === "'") fail("Single quotes are not valid JSON — use double quotes");
      fail(`Unexpected character '${ch}'`);
    }

    function parseObject() {
      const out = {};
      expect('{');
      skipWhitespace();
      if (source[i] === '}') { advance(1); return out; }
      for (;;) {
        skipWhitespace();
        if (source[i] !== '"') fail('Object keys must be double-quoted strings');
        const key = parseString();
        skipWhitespace();
        expect(':');
        out[key] = parseValue();
        skipWhitespace();
        if (source[i] === ',') {
          advance(1);
          skipWhitespace();
          if (source[i] === '}') fail('Trailing comma before }');
          continue;
        }
        if (source[i] === '}') { advance(1); return out; }
        fail("Expected ',' or '}' in object");
      }
    }

    function parseArray() {
      const out = [];
      expect('[');
      skipWhitespace();
      if (source[i] === ']') { advance(1); return out; }
      for (;;) {
        out.push(parseValue());
        skipWhitespace();
        if (source[i] === ',') {
          advance(1);
          skipWhitespace();
          if (source[i] === ']') fail('Trailing comma before ]');
          continue;
        }
        if (source[i] === ']') { advance(1); return out; }
        fail("Expected ',' or ']' in array");
      }
    }

    const ESCAPES = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };

    function parseString() {
      expect('"');
      let out = '';
      for (;;) {
        const ch = source[i];
        if (ch === undefined) fail('Unterminated string');
        if (ch === '"') { advance(1); return out; }
        if (ch === '\n') fail('Unescaped newline in string — use \\n');
        if (ch === '\\') {
          advance(1);
          const esc = source[i];
          if (esc === 'u') {
            const hex = source.slice(i + 1, i + 5);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('Invalid \\u escape — expected 4 hex digits');
            out += String.fromCharCode(parseInt(hex, 16));
            advance(5);
          } else if (esc in ESCAPES) {
            out += ESCAPES[esc];
            advance(1);
          } else {
            fail(`Invalid escape '\\${esc}'`);
          }
          continue;
        }
        out += ch;
        advance(1);
      }
    }

    function parseNumber() {
      const start = i;
      if (source[i] === '-') advance(1);
      if (source[i] === '0') {
        advance(1);
      } else if (source[i] >= '1' && source[i] <= '9') {
        while (source[i] >= '0' && source[i] <= '9') advance(1);
      } else {
        fail('Invalid number');
      }
      if (source[i] === '.') {
        advance(1);
        if (!(source[i] >= '0' && source[i] <= '9')) fail('Expected digit after decimal point');
        while (source[i] >= '0' && source[i] <= '9') advance(1);
      }
      if (source[i] === 'e' || source[i] === 'E') {
        advance(1);
        if (source[i] === '+' || source[i] === '-') advance(1);
        if (!(source[i] >= '0' && source[i] <= '9')) fail('Expected digit in exponent');
        while (source[i] >= '0' && source[i] <= '9') advance(1);
      }
      return Number(source.slice(start, i));
    }

    skipWhitespace();
    if (i >= source.length) fail('Empty input');
    const value = parseValue();
    skipWhitespace();
    if (i < source.length) fail('Unexpected trailing content after the top-level value');
    return value;
  }

  /** Walk a parsed value and report size/shape figures for the status bar. */
  function stats(value) {
    let nodes = 0, objects = 0, arrays = 0, strings = 0, numbers = 0, depth = 0;
    (function walk(v, d) {
      nodes++;
      depth = Math.max(depth, d);
      if (Array.isArray(v)) {
        arrays++;
        v.forEach((item) => walk(item, d + 1));
      } else if (v && typeof v === 'object') {
        objects++;
        Object.values(v).forEach((item) => walk(item, d + 1));
      } else if (typeof v === 'string') {
        strings++;
      } else if (typeof v === 'number') {
        numbers++;
      }
    })(value, 1);
    return { nodes, objects, arrays, strings, numbers, depth };
  }

  global.JSONLensParser = { parse, stats };
})(window);
