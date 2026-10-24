#!/usr/bin/env node
/* 截图和交互对比：迁移一页前后各拍一次，再对比。

   npm run shots -- shoot <名字> [--pages index] [--configs desktop-light,mobile-dark]
     对 docs/ 里现有的产物截图（先 npm run build），存到 shots/<名字>/。
     桌面、手机 × 浅色、深色；每个配置都是全新的浏览器上下文（localStorage 为空），等字体加载完再截。
     截什么：每页顶部一屏；目录栏、每个章节 / 部分标题 / 首页区块、翻页、页脚（按元素 id 命名）；
       展开全部问答和折叠块后（@open）、点完自测后（@quiz）有变化的章节；
       shots.config.mjs 里每个交互演示操作完的演示框（@demo-名字）。
     检查什么：控制台报错和页面异常、404 和失败的请求、外部请求（一律拦下）、重复 id、站内链接和锚点。
       结果在 shots/<名字>/report.json，并打印在终端。

   npm run shots -- compare <旧名字> <新名字>
     逐张比对像素（pixelmatch，忽略抗锯齿），生成 shots/compare-<旧>-<新>/index.html：
     有变化的截图并排显示“旧 / 新 / 差异”（裁到变化区域），外加缺少、新增的截图和新出现的问题。
     两次截图的平台不同（Windows / Linux / macOS）时拒绝比对：字体渲染不同，像素比对没有意义。 */
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve, relative, extname, dirname, isAbsolute, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'shots');
const book = (await import(pathToFileURL(join(ROOT, 'notes.config.mjs')).href)).default;
const DOCS = join(ROOT, book.out || 'docs');
const { demos = {} } = (await import(pathToFileURL(join(ROOT, 'scripts', 'shots.config.mjs')).href)).default;

const CONFIGS = {
  'desktop-light': { viewport: { width: 1280, height: 800 }, colorScheme: 'light' },
  'desktop-dark': { viewport: { width: 1280, height: 800 }, colorScheme: 'dark' },
  'mobile-light': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' },
  'mobile-dark': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' }
};
const COMMON = { locale: 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' };
const SHOT = { animations: 'disabled', caret: 'hide', timeout: 15000 };
/* 截元素时：吸顶的目录栏和手机顶部细条改成 static（它们在文档流里本来就占这个位置，不影响布局），免得盖住元素 */
const UNSTICK = 'nav.rail,.mbar{position:static!important;transform:none!important}';

const [cmd, ...rest] = process.argv.slice(2);
const opts = {}, args = [];
for (let i = 0; i < rest.length; i++){
  if (rest[i].startsWith('--')) opts[rest[i].slice(2)] = rest[++i]; else args.push(rest[i]);
}
const label = s => { if (!s || !/^[\w.-]+$/.test(s)) die('名字只能用字母、数字、. - _：' + (s || '（空）')); return s; };
function die(msg){ console.error('shots：' + msg); process.exit(1); }

if (cmd === 'shoot') await shoot(label(args[0]));
else if (cmd === 'compare') await compare(label(args[0]), label(args[1]));
else die('用法：npm run shots -- shoot <名字> [--pages a,b] [--configs desktop-light,...] | compare <旧> <新>');

/* ---------------- 截图 ---------------- */

async function shoot(name){
  if (!existsSync(join(DOCS, 'index.html'))) die(`${relative(ROOT, DOCS)}/ 里没有产物，先 npm run build`);
  const pages = opts.pages ? opts.pages.split(',') : book.pages.map(p => p.file);
  const configs = opts.configs ? opts.configs.split(',') : Object.keys(CONFIGS);
  for (const c of configs) if (!CONFIGS[c]) die('不认识的配置：' + c + '（可用：' + Object.keys(CONFIGS).join('、') + '）');
  for (const p of pages) if (!existsSync(join(DOCS, p + '.html'))) die('没有这一页：' + p + '.html');

  const out = join(SHOTS, name);
  if (existsSync(out)){
    if (!opts.force) die(`shots/${name}/ 已存在。换个名字，或加 --force yes 覆盖`);
    rmSync(out, { recursive: true, force: true });
  }
  mkdirSync(out, { recursive: true });

  const { server, base } = await serve(DOCS);
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
  const browserVersion = 'chromium ' + browser.version();
  const problems = [];
  const idsByPage = {}, links = [];
  const add = (page, config, kind, detail) => problems.push({ page, config, kind, detail });
  let count = 0;

  try {
    for (const config of configs){
      const ctx = await browser.newContext({ ...COMMON, ...CONFIGS[config] });
      /* 外部请求一律拦下并记录：截图不受网络影响 */
      await ctx.route(url => !url.href.startsWith(base), r => r.abort());
      for (const page of pages){
        const dir = join(out, config, page);
        mkdirSync(dir, { recursive: true });
        const p = await ctx.newPage();
        watch(p, (kind, detail) => add(page, config, kind, detail), base);
        await open(p, base + page + '.html');

        /* 第一个配置时收集 id 和链接（各配置相同） */
        const info = await p.evaluate(() => {
          const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
          const hrefs = [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href'));
          return { ids, hrefs };
        });
        const dup = [...new Set(info.ids.filter((x, i) => info.ids.indexOf(x) !== i))];
        if (dup.length) add(page, config, 'duplicate-id', dup.join(', '));
        if (!idsByPage[page]){ idsByPage[page] = new Set(info.ids); info.hrefs.forEach(h => links.push({ page, href: h })); }

        /* 顶部一屏 + 各区块 */
        await p.screenshot({ ...SHOT, path: join(dir, '_top.png') }); count++;
        const blocks = await mark(p);
        /* 第一个配置时导出每个区块的文字，供 compare 逐字比对（各配置文字相同） */
        if (config === configs[0]) await dumpText(p, join(out, 'text', page));
        for (const b of blocks){ await shotEl(p, `[data-shot="${b}"]`, join(dir, b + '.png'), e => add(page, config, 'shot-failed', `${b}：${e.message}`)); count++; }

        /* 手机：点顶部细条打开目录弹层，截一屏，再按 Esc 关掉 */
        const bar = p.locator('.mbar-btn');
        if (await bar.isVisible()){
          try {
            await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await settle(p);
            await bar.click(); await settle(p); await p.waitForTimeout(400);
            await p.screenshot({ ...SHOT, path: join(dir, 'toc@open.png') }); count++;
            await p.keyboard.press('Escape'); await p.waitForTimeout(400); await neutral(p);
          } catch (e){ add(page, config, 'shot-failed', `toc@open：${e.message.split('\n')[0]}`); }
        }

        /* 展开所有问答、名词卡、参考实现 */
        const opened = await withChange(p, async () => {
          for (const b of await p.locator('[data-toggle-qa]').all()) await b.click();
          /* 每次重新找第一个可见的未展开块：展开外层后，里层才变得可见 */
          for (let guard = 0; guard < 500; guard++){
            const s = p.locator('details:not([open]) > summary').filter({ visible: true }).first();
            if (!(await s.count())) break;
            await s.click();
          }
        });
        for (const b of opened){ await shotEl(p, `[data-shot="${b}"]`, join(dir, b + '@open.png'), e => add(page, config, 'shot-failed', `${b}@open：${e.message}`)); count++; }

        /* 点自测：第 i 题点第 i 个选项（对错都有，结果固定） */
        const answered = await withChange(p, async () => {
          const qs = p.locator('.selftest .q');
          const n = await qs.count();
          for (let i = 0; i < n; i++){
            const o = qs.nth(i).locator('button.opt');
            const k = await o.count();
            if (k && await o.nth(i % k).isEnabled()) await o.nth(i % k).click();
          }
        });
        for (const b of answered){ await shotEl(p, `[data-shot="${b}"]`, join(dir, b + '@quiz.png'), e => add(page, config, 'shot-failed', `${b}@quiz：${e.message}`)); count++; }

        /* 交互演示：每个都在重新打开的页面上做 */
        for (const d of demos[page] || []){
          await open(p, base + page + '.html');
          try {
            const skipped = await runDemo(p, d);
            if (skipped) continue;
            const sel = await p.locator(d.shoot).first().evaluate(e => { const t = e.closest('.panel') || e; t.setAttribute('data-shot-demo', ''); return '[data-shot-demo]'; });
            await shotEl(p, sel, join(dir, '@demo-' + d.name + '.png')); count++;
          } catch (e){ add(page, config, 'demo-failed', `${d.name}：${e.message.split('\n')[0]}`); }
        }
        await p.close();
        process.stdout.write(`  ${config} ${page}\n`);
      }
      await ctx.close();
    }

    /* 站内链接和锚点 */
    for (const { page, href } of links){
      if (!href || /^(https?:|mailto:|javascript:)/i.test(href)) continue;
      const u = new URL(href, base + page + '.html');
      if (!u.href.startsWith(base)){ add(page, '', 'bad-link', href); continue; }
      const file = decodeURIComponent(u.pathname.slice(1)) || 'index.html';
      if (!existsSync(join(DOCS, file))){ add(page, '', 'broken-link', `${href}（没有 ${file}）`); continue; }
      const hash = decodeURIComponent(u.hash.slice(1));
      if (!hash || !file.endsWith('.html')) continue;
      const target = file.replace(/\.html$/, '');
      if (!idsByPage[target]) idsByPage[target] = await collectIds(browser, base + file);
      if (!idsByPage[target].has(hash)) add(page, '', 'broken-anchor', `${href}（${file} 里没有 id="${hash}"）`);
    }
  } finally {
    await browser.close();
    server.close();
  }

  const uniq = dedupe(problems);
  const meta = {
    name, time: new Date().toISOString(), platform: process.platform, arch: process.arch,
    browser: browserVersion, playwright: JSON.parse(readFileSync(join(ROOT, 'node_modules/playwright/package.json'), 'utf8')).version,
    pages, configs, shots: count,
    book: git(ROOT), theme: git(realpathSync(join(ROOT, 'node_modules/notes-theme')))
  };
  writeFileSync(join(out, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  writeFileSync(join(out, 'report.json'), JSON.stringify(uniq, null, 2) + '\n');
  console.log(`shots：${count} 张 → shots/${name}/（${meta.browser}，${meta.platform}）`);
  printProblems(uniq);
}

/* 给要截图的区块打上 data-shot 标记，返回名字列表（按 id 命名，迁移前后能对上） */
function mark(p){
  return p.evaluate(() => {
    const names = [];
    const used = new Set();
    const add = (el, n) => {
      /* 不显示的不截：只有一页时的翻页、手机上收在弹层里的目录栏（弹层另外截，见 toc@open） */
      if (!el || el.hasAttribute('data-shot') || !el.checkVisibility({ visibilityProperty: true })) return;
      let k = n, i = 2; while (used.has(k)) k = n + '-' + i++;
      used.add(k); el.setAttribute('data-shot', k); names.push(k);
    };
    add(document.querySelector('nav.rail'), 'rail');
    document.querySelectorAll('main > header, main > section, main > .part-head, main section.ch').forEach(el =>
      add(el, el.id || (el.className || el.tagName).toString().split(' ')[0].toLowerCase()));
    add(document.querySelector('#pager, nav.pager'), 'pager');
    add(document.querySelector('main > footer, footer'), 'footer');
    return names;
  });
}

/* 每个区块的文字（textContent，去掉脚本和样式），空白合并成一个空格，按句子分行，方便逐字 diff */
async function dumpText(p, dir){
  mkdirSync(dir, { recursive: true });
  const texts = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-shot]')].map(e => {
    const c = e.cloneNode(true);
    c.querySelectorAll('script,style').forEach(x => x.remove());
    return [e.dataset.shot, c.textContent];
  })));
  for (const [k, t] of Object.entries(texts))
    writeFileSync(join(dir, k + '.txt'), t.replace(/\s+/g, ' ').trim().replace(/([。！？；])\s*/g, '$1\n') + '\n');
}

/* 执行操作，返回内容有变化的区块名 */
async function withChange(p, fn){
  const snap = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-shot]')].map(e => [e.dataset.shot, e.innerHTML + '|' + [...e.querySelectorAll('details')].map(d => d.open).join()])));
  const before = await snap();
  await fn();
  await neutral(p);
  const after = await snap();
  return Object.keys(after).filter(k => k !== 'rail' && after[k] !== before[k]);
}

async function runDemo(p, d){
  for (const a of d.actions){
    const sel = a.click || a.set || a.check || a.press;
    const all = p.locator(sel);
    const n = await all.count();
    const nth = a.nth == null ? 0 : a.nth < 0 ? n + a.nth : a.nth;
    if (nth >= n || nth < 0){
      if (d.optional) return true;
      throw new Error(`找不到 ${sel}${a.nth != null ? ` 的第 ${a.nth} 个` : ''}（共 ${n} 个）`);
    }
    const el = all.nth(nth);
    if (a.click){ if (a.ifEnabled && !(await el.isEnabled())) continue; await el.click(); }
    else if (a.set != null) await el.evaluate((e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, String(a.value));
    else if (a.check) await el.setChecked(a.on !== false);
    else if (a.press) await el.press(a.key);
  }
  await neutral(p);
  return false;
}

/* 截一个元素：先把页面滚到元素顶端（取整像素，避免文字落在不同的亚像素位置），
   截图时吸顶的目录栏改成 static（它在文档流里本来就占这个位置，不影响布局），免得盖住元素 */
async function shotEl(p, sel, path, onError){
  try {
    const loc = p.locator(sel).first();
    await loc.evaluate(e => window.scrollTo({ top: Math.max(0, Math.round(e.getBoundingClientRect().top + window.scrollY)), behavior: "instant" }));
    await settle(p);
    /* 只让被截的元素（和它所在的章）强制渲染：主题给章节加了 content-visibility:auto，比视口高很多的元素截图时，
       屏幕外的部分在 Playwright 看来“不可见”，会截成空白（读者滚动时不会）。全部章节都强制渲染会让每次截图都排版整本书，很慢 */
    await loc.screenshot({ ...SHOT, style: UNSTICK + ` ${sel},section.ch:has(${sel}){content-visibility:visible!important}`, path });
  } catch (e){ if (onError) onError(e); else throw e; }
}

async function open(p, url){
  await p.goto(url, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await settle(p);
}

/* 等脚本触发的布局和平滑滚动结束：页面和所有可滚动元素的位置连续 5 帧不变（最多等 3 秒）。
   目录栏用 scrollTo({ behavior: 'smooth' }) 跟随当前章节，只等两帧会截到滚动中途。 */
/* 截图前把鼠标移开、取消焦点：悬停和焦点框的过渡会让同一状态截出不同像素 */
async function neutral(p){
  await p.mouse.move(0, 0);
  await p.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
  await settle(p);
}

function settle(p){
  return p.evaluate(() => new Promise(done => {
    const scrollers = [document.scrollingElement, ...[...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(e).overflowY))];
    const pos = () => scrollers.map(e => e.scrollTop + ',' + e.scrollLeft).join(';');
    let last = pos(), still = 0;
    const t0 = performance.now();
    const tick = () => {
      const now = pos();
      still = now === last ? still + 1 : 0;
      last = now;
      if (still >= 5 || performance.now() - t0 > 3000) done(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
}

function watch(p, add, base){
  p.on('console', m => { if (m.type() === 'error') add('console-error', m.text()); });
  p.on('pageerror', e => add('page-error', e.message));
  p.on('requestfailed', r => add(r.url().startsWith(base) ? 'request-failed' : 'external-request', r.url().replace(base, '/') + (r.url().startsWith(base) ? '（' + (r.failure() || {}).errorText + '）' : '')));
  p.on('response', r => { if (r.status() >= 400) add('http-' + r.status(), r.url().replace(base, '/')); });
}

async function collectIds(browser, url){
  const p = await browser.newPage();
  try { await open(p, url); return new Set(await p.evaluate(() => [...document.querySelectorAll('[id]')].map(e => e.id))); }
  finally { await p.close(); }
}

/* 静态服务器：只读 docs/，只监听 127.0.0.1 */
async function serve(dir){
  const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
  const server = createServer(async (req, res) => {
    let file;
    try { file = resolve(dir, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname)); }
    catch { res.writeHead(400).end(); return; }
    const r = relative(dir, file);
    if (r.startsWith('..') || isAbsolute(r)){ res.writeHead(403).end(); return; }
    try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch {}
    try { const body = await readFile(file); res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(body); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}/` };
}

function git(dir){
  try {
    const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: dir }).toString().trim();
    const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: dir }).toString().trim() !== '';
    const branch = execFileSync('git', ['branch', '--show-current'], { cwd: dir }).toString().trim();
    return `${branch}@${head}${dirty ? '（有未提交的改动）' : ''}`;
  } catch { return '未知'; }
}

/* 同一问题在多个配置里出现时合并成一条 */
function dedupe(list){
  const m = new Map();
  for (const x of list){
    const k = [x.page, x.kind, x.detail].join('\u0000');
    if (!m.has(k)) m.set(k, { page: x.page, kind: x.kind, detail: x.detail, configs: [] });
    if (x.config && !m.get(k).configs.includes(x.config)) m.get(k).configs.push(x.config);
  }
  return [...m.values()];
}

function printProblems(list){
  if (!list.length){ console.log('检查：没有发现问题'); return; }
  console.log(`检查：${list.length} 个问题`);
  for (const x of list) console.log(`  [${x.kind}] ${x.page}：${x.detail}${x.configs.length && x.configs.length < 4 ? `（${x.configs.join('、')}）` : ''}`);
}

/* ---------------- 对比 ---------------- */

async function compare(a, b){
  const A = join(SHOTS, a), B = join(SHOTS, b);
  for (const d of [A, B]) if (!existsSync(join(d, 'meta.json'))) die('没有这次截图：' + relative(ROOT, d));
  const ma = JSON.parse(readFileSync(join(A, 'meta.json'), 'utf8')), mb = JSON.parse(readFileSync(join(B, 'meta.json'), 'utf8'));
  if (ma.platform !== mb.platform) die(`两次截图的平台不同（${a}：${ma.platform}，${b}：${mb.platform}），字体渲染不同，不能比像素。在同一平台上重拍基线。`);
  const warn = [];
  if (ma.browser !== mb.browser) warn.push(`浏览器版本不同（${ma.browser} → ${mb.browser}），可能有和改动无关的像素差`);

  const out = join(SHOTS, `compare-${a}-${b}`);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const fa = new Set(list(A)), fb = new Set(list(B));
  const missing = [...fa].filter(f => !fb.has(f)).sort(), added = [...fb].filter(f => !fa.has(f)).sort();
  const changed = [];
  let same = 0;
  for (const f of [...fa].filter(f => fb.has(f)).sort()){
    const ba = readFileSync(join(A, f)), bb = readFileSync(join(B, f));
    if (ba.equals(bb)){ same++; continue; }
    const r = diff(PNG.sync.read(ba), PNG.sync.read(bb));
    if (r.pixels === 0){ same++; continue; }
    const id = changed.length;
    if (r.crop){
      for (const [k, png] of Object.entries(r.crop)) writeFileSync(join(out, `${id}-${k}.png`), PNG.sync.write(png));
    }
    changed.push({ file: f, id, ...r, crop: !!r.crop });
  }

  const ra = JSON.parse(readFileSync(join(A, 'report.json'), 'utf8')), rb = JSON.parse(readFileSync(join(B, 'report.json'), 'utf8'));
  const key = x => [x.page, x.kind, x.detail].join('\u0000');
  const ka = new Set(ra.map(key)), kb = new Set(rb.map(key));
  const newProblems = rb.filter(x => !ka.has(key(x))), gone = ra.filter(x => !kb.has(key(x)));

  const text = textDiff(join(A, 'text'), join(B, 'text'));
  writeFileSync(join(out, 'index.html'), page({ a, b, ma, mb, warn, same, changed, missing, added, newProblems, gone, A, B, out, text }));
  console.log(`compare：相同 ${same}，有变化 ${changed.length}（其中细微 ${changed.filter(c => c.thin).length}），缺少 ${missing.length}，新增 ${added.length}；新问题 ${newProblems.length}，消失的问题 ${gone.length}`);
  warn.forEach(w => console.log('注意：' + w));
  for (const c of changed) console.log(`  ${c.thin ? '细微' : '变化'} ${c.file}  ${c.size ? '尺寸 ' + c.size : c.pixels + ' 像素'}`);
  for (const f of missing) console.log('  缺少 ' + f);
  for (const f of added) console.log('  新增 ' + f);
  if (newProblems.length){ console.log('新出现的问题：'); printProblems(newProblems); }
  if (text){
    console.log(`文字：${text.length ? text.length + ' 个区块有改动' : '没有改动'}`);
    for (const t of text) console.log(`  ${t.file}  ${t.status}`);
  } else console.log('文字：有一次截图没有导出文字，跳过');
  console.log('报告：' + relative(ROOT, join(out, 'index.html')));
}

function list(dir, pre = ''){
  const out = [];
  for (const e of readdirSync(join(dir, pre), { withFileTypes: true })){
    const r = pre ? pre + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...list(dir, r)); else if (e.name.endsWith('.png')) out.push(r);
  }
  return out;
}

/* 逐像素比对。尺寸不同时按较大的画布比（多出来的部分算变化）。返回变化像素数和裁到变化区域的三张图。 */
function diff(a, b){
  const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
  const pa = pad(a, w, h), pb = pad(b, w, h);
  const d = new PNG({ width: w, height: h });
  const pixels = pixelmatch(pa.data, pb.data, d.data, w, h, { threshold: 0.1, includeAA: false, alpha: 0.2 });
  const size = a.width !== b.width || a.height !== b.height ? `${a.width}×${a.height} → ${b.width}×${b.height}` : '';
  if (!pixels && !size) return { pixels: 0 };
  /* 变化区域：diff 图里纯红的像素（pixelmatch 的默认差异色） */
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const i = (y * w + x) * 4;
    if (d.data[i] === 255 && d.data[i + 1] === 0 && d.data[i + 2] === 0){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0){ x0 = 0; y0 = Math.min(a.height, b.height); x1 = w - 1; y1 = h - 1; }
  const m = 40, maxH = 2400;
  const cx = Math.max(0, x0 - m), cy = Math.max(0, y0 - m);
  const cw = Math.min(w, x1 + m + 1) - cx, ch = Math.min(h, Math.min(y1 + m + 1, cy + maxH)) - cy;
  const crop = { before: cut(pa, cx, cy, cw, ch), after: cut(pb, cx, cy, cw, ch), diff: cut(d, cx, cy, cw, ch) };
  const thin = !size && pixels <= 2000 && (x1 - x0 < 3 || y1 - y0 < 3);
  return { pixels, size, thin, box: `x ${cx}–${cx + cw}，y ${cy}–${cy + ch}${y1 + m + 1 - cy > maxH ? '（只显示开头 ' + maxH + 'px）' : ''}`, crop };
}

function pad(png, w, h){
  if (png.width === w && png.height === h) return png;
  const out = new PNG({ width: w, height: h });
  out.data.fill(0);
  PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);
  return out;
}

function cut(png, x, y, w, h){
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(png, out, x, y, w, h, 0, 0);
  return out;
}

/* 用 git diff --no-index 逐字比对两次导出的文字。返回每个有改动的文件和带 [-删-]{+增+} 标记的片段 */
function textDiff(da, db){
  if (!existsSync(da) || !existsSync(db)) return null;
  let raw = '';
  const rel = d => relative(SHOTS, d).split(sep).join('/');
  const git = ['-c', 'core.autocrlf=false', '-c', 'core.safecrlf=false', '-c', 'core.quotepath=off', 'diff', '--no-index', '--no-color', '--word-diff=plain', '--word-diff-regex=[^[:space:]]', '-U1', rel(da), rel(db)];
  try { raw = execFileSync('git', git, { cwd: SHOTS, maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] }).toString(); }
  catch (e){ if (e.status !== 1) throw e; raw = e.stdout.toString(); }
  const out = [];
  for (const part of raw.split(/^diff --git /m).slice(1)){
    const m = /^--- (?:a\/)?(.+)$/m.exec(part), n = /^\+\+\+ (?:b\/)?(.+)$/m.exec(part);
    const fa = m && m[1] !== '/dev/null' ? m[1] : null, fb = n && n[1] !== '/dev/null' ? n[1] : null;
    const name = (fb || fa).replace(/\\/g, '/').split('/text/').pop();
    const status = !fa ? '新增' : !fb ? '缺少' : '有改动';
    const body = part.split(/^@@.*@@.*$/m).slice(1).join('\n…\n').trim();
    out.push({ file: name, status, body });
  }
  return out;
}

function page({ a, b, ma, mb, warn, same, changed, missing, added, newProblems, gone, A, B, out, text }){
  const e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rel = p => e(relative(out, p).split(sep).join('/'));
  const probs = l => l.length ? '<ul>' + l.map(x => `<li><code>${e(x.kind)}</code> ${e(x.page)}：${e(x.detail)}</li>`).join('') + '</ul>' : '<p class="muted">无</p>';
  const files = (l, dir) => l.length ? '<ul>' + l.map(f => `<li><a href="${rel(join(dir, f))}">${e(f)}</a></li>`).join('') + '</ul>' : '<p class="muted">无</p>';
  const big = changed.filter(c => !c.thin), thin = changed.filter(c => c.thin);
  const items = l => l.map(c => `<div class="item"><h3>${e(c.file)}</h3><p class="muted">${c.size ? '尺寸 ' + e(c.size) + '；' : ''}${c.pixels} 个像素不同；区域 ${e(c.box || '')} · <a href="${rel(join(A, c.file))}">旧图</a> · <a href="${rel(join(B, c.file))}">新图</a></p>
<div class="trio"><figure><figcaption>旧</figcaption><img loading="lazy" src="${c.id}-before.png"></figure><figure><figcaption>新</figcaption><img loading="lazy" src="${c.id}-after.png"></figure><figure><figcaption>差异（红色）</figcaption><img loading="lazy" src="${c.id}-diff.png"></figure></div></div>`).join('') || '<p class="muted">无</p>';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>截图对比 ${e(a)} → ${e(b)}</title>
<style>
:root{--bg:#fff;--ink:#1c1c1c;--muted:#6b6b6b;--line:#ddd;--card:#f6f6f4;--bad:#c0392b}
@media (prefers-color-scheme: dark){:root{--bg:#161616;--ink:#e8e8e8;--muted:#9a9a9a;--line:#333;--card:#202020;--bad:#ff7b6b}}
body{margin:0;padding:24px 16px 64px;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,sans-serif}
main{max-width:1500px;margin:0 auto}
h1{font-size:1.4rem;margin:0 0 4px}h2{font-size:1.1rem;margin:32px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}
.muted{color:var(--muted)}.warn{color:var(--bad)}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}.stats div{background:var(--card);padding:8px 14px;border-radius:8px}.stats b{font-size:1.3rem;display:block}
.item{margin:24px 0;border:1px solid var(--line);border-radius:8px;padding:12px}
.item h3{margin:0 0 8px;font-size:.95rem;font-family:ui-monospace,monospace;word-break:break-all}
.trio{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.trio figure{margin:0}.trio figcaption{font-size:.8rem;color:var(--muted)}
.trio img{width:100%;height:auto;border:1px solid var(--line);background:#fff}
@media (max-width:800px){.trio{grid-template-columns:1fr}}
code{font-size:.85em}
.wd{white-space:pre-wrap;word-break:break-all;font-size:.85rem;max-height:480px;overflow:auto;background:var(--card);padding:8px;border-radius:6px}
del{background:color-mix(in srgb,var(--bad) 25%,transparent);text-decoration:line-through}ins{background:color-mix(in srgb,#2e9d57 30%,transparent);text-decoration:none}
</style></head><body><main>
<h1>截图对比：${e(a)} → ${e(b)}</h1>
<p class="muted">${e(a)}：${e(ma.time)} · ${e(ma.book)} · 主题 ${e(ma.theme)}<br>${e(b)}：${e(mb.time)} · ${e(mb.book)} · 主题 ${e(mb.theme)}<br>${e(mb.browser)} · ${e(mb.platform)}</p>
${warn.map(w => `<p class="warn">注意：${e(w)}</p>`).join('')}
<div class="stats"><div><b>${same}</b>相同</div><div><b>${big.length}</b>有变化</div><div><b>${thin.length}</b>细微</div><div><b>${missing.length}</b>缺少</div><div><b>${added.length}</b>新增</div><div><b>${newProblems.length}</b>新问题</div></div>
<h2>新出现的问题</h2>${probs(newProblems)}
<h2>文字改动（${text ? text.length : '未比对'}）</h2>
${!text ? '<p class="muted">有一次截图没有导出文字</p>' : text.length ? text.map(t => `<div class="item"><h3>${e(t.file)} · ${e(t.status)}</h3><pre class="wd">${e(t.body).replace(/\[-([\s\S]*?)-\]/g, '<del>$1</del>').replace(/\{\+([\s\S]*?)\+\}/g, '<ins>$1</ins>')}</pre></div>`).join('') : '<p class="muted">无：所有区块的文字逐字相同</p>'}
<h2>有变化（${big.length}）</h2>
${items(big)}
<h2>细微差异（${thin.length}）</h2>
<p class="muted">变化只是一条 1–3 像素宽的线、总共不到 2000 个像素。多半是亚像素边界的渲染抖动（同一份产物重拍也偶尔出现），但丢了一条边框也是这个样子，请看一眼。</p>
${items(thin)}
<h2>缺少的截图（${e(a)} 有，${e(b)} 没有）</h2>${files(missing, A)}
<h2>新增的截图</h2>${files(added, B)}
<h2>消失的问题</h2>${probs(gone)}
</main></body></html>
`;
}
