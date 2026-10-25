import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decode, isEntryFile, dateFromName, localDay, resolveDate, parseDates, serializeDates,
  titleOf, topicsOf, sortEntries, entryHref, publicDirs, WIDGET_TAG, injectWidget, navData, allowSelf,
} from './lib.mjs';

const entry = (file, date, title = file) => ({ file, date, title, topics: [] });
const files = (list) => list.map((e) => e.file);

test('decode strips tags and entities', () => {
  assert.equal(decode(' Vue &amp; <em>Nuxt</em>&nbsp;&quot;Brief&quot; &#39;26 '), 'Vue & Nuxt "Brief" \'26');
});

test('decode turns a line break into a space', () => {
  assert.equal(decode('Bangladesh Stock Market<br>Complete Beginner\'s Guide'), 'Bangladesh Stock Market Complete Beginner\'s Guide');
  assert.equal(decode('Beyond <span>commit</span><BR />&amp; push'), 'Beyond commit & push');
});

test('decode reads numeric and common named entities', () => {
  assert.equal(decode('Don&#8217;t &mdash; it&rsquo;s &#x2014; &ldquo;ok&rdquo;&hellip;'), 'Don’t — it’s — “ok”…');
});

test('dateFromName and parseDates reject impossible days', () => {
  assert.equal(dateFromName('foo-2026-13-01.html'), null);
  assert.equal(dateFromName('2026-02-30.html'), null);
  assert.deepEqual(
    parseDates('{"a/x.html":"2026-13-45","a/y.html":"2026-02-30","a/z.html":"2024-02-29"}'),
    { dates: { 'a/z.html': '2024-02-29' }, ok: true },
  );
});

test('isEntryFile keeps report html only', () => {
  const names = ['index.html', 'Friday Java Brief.html', '.gitkeep', '.DS_Store', 'notes.md', 'a-2026-09-27.html'];
  assert.deepEqual(names.filter(isEntryFile), ['Friday Java Brief.html', 'a-2026-09-27.html']);
});

test('dateFromName reads only YYYY-MM-DD names', () => {
  assert.equal(dateFromName('agentic-daily-2026-09-27.html'), '2026-09-27');
  assert.equal(dateFromName('2026-10-04.html'), '2026-10-04');
  assert.equal(dateFromName('Friday Java Brief.html'), null);
  assert.equal(dateFromName('Agentic Daily 4 Oct 2026.html'), null);
});

test('localDay uses the local calendar day', () => {
  assert.equal(localDay(new Date(2026, 3, 28, 0, 30).getTime()), '2026-04-28');
  assert.equal(localDay(new Date(2026, 3, 28, 23, 59).getTime()), '2026-04-28');
});

test('resolveDate prefers name, then saved, then mtime', () => {
  const mtime = new Date(2026, 9, 5, 12).getTime();
  assert.deepEqual(resolveDate('x-2026-09-27.html', '2026-01-01', mtime), { date: '2026-09-27', source: 'name' });
  assert.deepEqual(resolveDate('Brief.html', '2026-04-28', mtime), { date: '2026-04-28', source: 'saved' });
  assert.deepEqual(resolveDate('Brief.html', undefined, mtime), { date: '2026-10-05', source: 'mtime' });
});

test('parseDates keeps valid days and rejects broken input', () => {
  assert.deepEqual(
    parseDates('{"a/b.html":"2026-04-28","a/c.html":"soon","a/d.html":5}'),
    { dates: { 'a/b.html': '2026-04-28' }, ok: true },
  );
  for (const bad of ['{oops', '[]', 'null', '', '"2026-04-28"']) {
    assert.deepEqual(parseDates(bad), { dates: {}, ok: false }, bad);
  }
});

test('serializeDates sorts keys and ends with a newline', () => {
  assert.equal(
    serializeDates({ 'b/x.html': '2026-01-02', 'a/y.html': '2026-01-01' }),
    '{\n  "a/y.html": "2026-01-01",\n  "b/x.html": "2026-01-02"\n}\n',
  );
  assert.equal(serializeDates({}), '{}\n');
});

test('titleOf falls back from h1 to title to file name', () => {
  assert.equal(titleOf('<title>T</title><h1 class="x">Vue &amp; Nuxt <em>Brief</em></h1>', 'f.html'), 'Vue & Nuxt Brief');
  assert.equal(titleOf('<title>Claude Code: Configuration &amp; Extensibility</title>', 'Inside Claude.html'), 'Claude Code: Configuration & Extensibility');
  assert.equal(titleOf('<h1>  </h1><p>x</p>', 'Inside Claude.html'), 'Inside Claude');
});

test('topicsOf reads keywords, else the first 4 h2', () => {
  assert.deepEqual(topicsOf('<meta name="keywords" content="MCP, Agents , ,Vue">'), ['MCP', 'Agents', 'Vue']);
  const h2 = ['A', 'B', 'C', 'D', 'E'].map((t) => `<h2 id="${t}">${t}</h2>`).join('');
  assert.deepEqual(topicsOf(h2), ['A', 'B', 'C', 'D']);
  assert.deepEqual(topicsOf('<p>none</p>'), []);
});

test('topicsOf and titleOf ignore markup inside script and style blocks', () => {
  const html = '<style>h1{}</style><script>const t = `<h1>${x}</h1><h2>${esc(q.q)}</h2>`;</script><title>Real</title><h2>Topic</h2>';
  assert.deepEqual(topicsOf(html), ['Topic']);
  assert.equal(titleOf(html, 'f.html'), 'Real');
});

test('sortEntries news: newest first, ties by file Z to A', () => {
  const { placed, unplaced, missing } = sortEntries('news', [
    entry('a.html', '2026-09-27'), entry('b.html', '2026-10-04'), entry('c.html', '2026-10-04'),
  ]);
  assert.deepEqual(files(placed), ['c.html', 'b.html', 'a.html']);
  assert.deepEqual(unplaced, []);
  assert.deepEqual(missing, []);
});

test('sortEntries guides: newest first, ties by title A to Z', () => {
  const { placed } = sortEntries('guides', [
    entry('z.html', '2026-04-28', 'Zeta'), entry('a.html', '2026-04-28', 'Alpha'), entry('n.html', '2026-10-05', 'New'),
  ]);
  assert.deepEqual(files(placed), ['n.html', 'a.html', 'z.html']);
});

test('sortEntries roadmap: order, then unplaced newest first, then missing', () => {
  const { placed, unplaced, missing } = sortEntries('roadmap', [
    entry('one.html', '2026-09-23'),
    entry('two.html', '2026-10-02'),
    entry('old.html', '2026-01-01'),
    entry('new.html', '2026-02-01'),
  ], ['two.html', 'gone.html', 'one.html', 'two.html']);
  assert.deepEqual(files(placed), ['two.html', 'one.html']);
  assert.deepEqual(files(unplaced), ['new.html', 'old.html']);
  assert.deepEqual(missing, ['gone.html']);
});

test('sortEntries roadmap without order puts all in unplaced', () => {
  const { placed, unplaced } = sortEntries('roadmap', [entry('one.html', '2026-09-23')]);
  assert.deepEqual(placed, []);
  assert.deepEqual(files(unplaced), ['one.html']);
});

test('sortEntries rejects an unknown kind', () => {
  assert.throws(() => sortEntries('blog', []), /unknown kind: blog/);
});

test('entryHref encodes spaces, ampersands and underscores safely', () => {
  assert.equal(entryHref('', 'vue-nuxt-weekly-news', 'Vue & Nuxt Friday Brief.html'), '/vue-nuxt-weekly-news/Vue%20%26%20Nuxt%20Friday%20Brief.html');
  assert.equal(
    entryHref('/repo', 'in-depth-learning', 'Join Lab_ Optimizing a 10-Table SQL Query.html'),
    '/repo/in-depth-learning/Join%20Lab_%20Optimizing%20a%2010-Table%20SQL%20Query.html',
  );
});

test('publicDirs keeps public sections in config order', () => {
  assert.deepEqual(publicDirs([
    { dir: 'a', visibility: 'public' }, { dir: 'b', visibility: 'private' }, { dir: 'c', visibility: 'public' },
  ]), ['a', 'c']);
});

test('injectWidget adds the line once, before </body>', () => {
  assert.equal(
    injectWidget('<html><body><p>x</p></body></html>'),
    `<html><body><p>x</p>${WIDGET_TAG}\n</body></html>`,
  );
});

test('injectWidget makes no change when the marker is there', () => {
  const once = injectWidget('<body></body>');
  assert.equal(injectWidget(once), null);
});

test('injectWidget handles an upper-case body tag', () => {
  assert.equal(injectWidget('<BODY>x</BODY>'), `<BODY>x${WIDGET_TAG}\n</BODY>`);
});

test('injectWidget appends when there is no body end tag', () => {
  assert.equal(injectWidget('<p>x</p>'), `<p>x</p>\n${WIDGET_TAG}\n`);
});

test('injectWidget uses the last body end tag', () => {
  const html = '<script>const s = "</body>";</script><body>x</body>';
  assert.equal(injectWidget(html), `<script>const s = "</body>";</script><body>x${WIDGET_TAG}\n</body>`);
});

test('navData keeps public sections, numbers roadmap steps, hides private titles', () => {
  const data = navData([
    {
      dir: 'ai-coach', short: 'AI Coach', color: '#7c3aed', on: '#ffffff', kind: 'roadmap', visibility: 'public',
      entries: [entry('b.html', '2026-10-02', 'Two'), entry('a.html', '2026-09-23', 'One')],
      unplaced: [entry('c.html', '2026-01-01', 'Extra')],
    },
    {
      dir: 'news', short: 'News', color: '#111111', on: '#ffffff', kind: 'news', visibility: 'public',
      entries: [entry('n.html', '2026-10-04', 'Daily')], unplaced: [],
    },
    {
      dir: 'personal-guide', short: 'Personal', color: '#6b7280', on: '#ffffff', kind: 'guides', visibility: 'private',
      entries: [entry('secret.html', '2026-10-04', 'Job Radar')], unplaced: [],
    },
  ]);
  assert.deepEqual(data, {
    sections: [
      {
        dir: 'ai-coach', short: 'AI Coach', color: '#7c3aed', on: '#ffffff',
        entries: [{ file: 'b.html', title: 'Two', n: 1 }, { file: 'a.html', title: 'One', n: 2 }, { file: 'c.html', title: 'Extra' }],
      },
      { dir: 'news', short: 'News', color: '#111111', on: '#ffffff', entries: [{ file: 'n.html', title: 'Daily' }] },
    ],
  });
  assert.ok(!JSON.stringify(data).includes('Job Radar'));
});

const csp = (policy) => `<head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"></head>`;

test('allowSelf adds self to script-src and replaces none in connect-src', () => {
  assert.equal(
    allowSelf(csp("default-src 'none'; script-src 'unsafe-inline'; connect-src 'none'; img-src data:")),
    csp("default-src 'none'; script-src 'unsafe-inline' 'self'; connect-src 'self'; img-src data:"),
  );
});

test('allowSelf makes no change when self is allowed or there is no policy', () => {
  assert.equal(allowSelf(csp("script-src 'self' 'unsafe-inline'; connect-src 'self'")), null);
  assert.equal(allowSelf(csp("img-src data:")), null);
  assert.equal(allowSelf(csp("default-src 'self'; img-src data:")), null);
  assert.equal(allowSelf('<head><meta charset="utf-8"></head>'), null);
  assert.equal(allowSelf('<meta http-equiv="Content-Security-Policy-Report-Only" content="script-src \'none\'">'), null);
});

test('allowSelf adds missing directives from default-src', () => {
  assert.equal(
    allowSelf(csp("default-src 'none'; style-src 'unsafe-inline'")),
    csp("default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'"),
  );
});

test('allowSelf handles attribute order and case', () => {
  assert.equal(
    allowSelf(`<META content="script-src 'unsafe-inline'" HTTP-EQUIV="content-security-policy">`),
    `<META content="script-src 'unsafe-inline' 'self'" HTTP-EQUIV="content-security-policy">`,
  );
});

test('allowSelf leaves an entity-encoded policy unchanged', () => {
  assert.equal(allowSelf(csp('script-src &#39;unsafe-inline&#39;; connect-src &#x27;none&#x27;')), null);
});
