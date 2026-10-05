(() => {
  const script = document.currentScript;
  if (!script || document.querySelector('[data-devlogs-nav-host]')) return;

  const root = new URL('..', new URL('.', script.src)).href;
  const parts = location.href.startsWith(root) ? location.href.slice(root.length).split(/[?#]/)[0].split('/') : [];
  const dir = parts.length > 1 ? parts[0] : '';
  const file = parts.length > 1 ? decodeURIComponent(parts[1]) : '';
  const href = (d, f) => `${root}${d}/${f ? encodeURIComponent(f) : ''}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  const css = `
:host{all:initial}
*{box-sizing:border-box;margin:0;padding:0}
.btn{position:fixed;left:16px;bottom:16px;z-index:2147483647;width:48px;height:48px;border-radius:50%;border:0;cursor:pointer;background:var(--c,#111);color:var(--on,#fff);font:600 22px/1 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25)}
.btn:focus-visible{outline:3px solid #3b82f6;outline-offset:2px}
.panel{position:fixed;left:16px;bottom:76px;z-index:2147483647;width:280px;max-width:calc(100vw - 32px);max-height:70vh;overflow:auto;padding:10px;border-radius:14px;background:#fff;color:#111;border:1px solid #e6e6e0;box-shadow:0 12px 32px rgba(0,0,0,.18);font:14px/1.4 system-ui,sans-serif;text-align:left}
.panel[hidden]{display:none}
a{display:flex;gap:8px;align-items:center;padding:7px 8px;border-radius:8px;color:inherit;text-decoration:none}
a:hover,a:focus-visible{background:#f3f3ef;outline:none}
.back{font-weight:700;font-size:15px}
h2{font:700 11px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#666;margin:12px 8px 4px}
ul{list-style:none}
b{flex:none;width:20px;height:20px;border-radius:50%;background:var(--c,#111);color:var(--on,#fff);font-size:11px;display:grid;place-items:center}
span{flex:1;min-width:0}
[aria-current]{font-weight:700}
[aria-current]::after{content:"\\25CF";color:var(--c,#111)}
@media (prefers-color-scheme:dark){.panel{background:#151515;color:#f3f3f3;border-color:#262626}a:hover,a:focus-visible{background:#1b1b1b}h2{color:#9a9a9a}}
@media print{.btn,.panel{display:none!important}}`;

  const host = document.createElement('div');
  host.setAttribute('data-devlogs-nav-host', '');
  host.style.cssText = 'all:initial!important';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${css}</style><nav class="panel" id="p" hidden></nav><button type="button" class="btn" aria-label="Site menu" title="Site menu" aria-expanded="false" aria-controls="p">&#9776;</button>`;
  document.body.appendChild(host);
  const btn = shadow.querySelector('.btn');
  const panel = shadow.querySelector('.panel');

  const render = (data) => {
    const sections = (data && data.sections) || [];
    const cur = sections.find((s) => s.dir === dir);
    if (cur) {
      host.style.setProperty('--c', cur.color);
      host.style.setProperty('--on', cur.on);
    }
    const name = cur ? cur.short : dir.replace(/-/g, ' ');
    let html = dir ? `<a class="back" href="${href(dir)}">&larr; Back to ${esc(name)}</a>` : '';
    html += `<a href="${root}">&#8962; Home</a>`;
    if (cur && cur.entries.length) {
      html += `<h2>In this section</h2><ul>${cur.entries.map((e) => `<li><a href="${href(dir, e.file)}"${e.file === file ? ' aria-current="page"' : ''}>${e.n ? `<b>${e.n}</b>` : ''}<span>${esc(e.title)}</span></a></li>`).join('')}</ul>`;
    }
    const others = sections.filter((s) => s.dir !== dir);
    if (others.length) {
      html += `<h2>Other sections</h2><ul>${others.map((s) => `<li><a href="${href(s.dir)}">${esc(s.short)}</a></li>`).join('')}</ul>`;
    }
    panel.innerHTML = html;
  };

  const setOpen = (open) => {
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) panel.querySelector('a')?.focus();
  };

  btn.addEventListener('click', () => setOpen(panel.hidden));
  shadow.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape' && !panel.hidden) {
      setOpen(false);
      btn.focus();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      setOpen(false);
      btn.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !e.composedPath().includes(host)) setOpen(false);
  });

  render(null);
  fetch(`${root}assets/nav-data.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => d && render(d))
    .catch(() => {});
})();
