// 改后 = 线上 0e1dca5 演示店页面原样（now/*.html，由真浏览器抓下）只换对应那一块。
// 跑法：node transform.mjs（需 3360 在服务本目录的上一级）。输出 after/<步>.html。
import { chromium } from '/Users/developer/dxm-douyin-sync/node_modules/playwright-core/index.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:3360/v2/after/';
const HL = 'background:#fde68a;border-radius:4px;padding:0 2px';

// 每一步：从哪张线上页面改，改什么（在页面里跑的函数，参数是 v1 内容）
const STEPS = {
  '01': { from: '01-onboarding-step1', edit: 'findStore' },
  '02': { from: '02-onboarding-step2-chat', edit: 'threeQuestions' },
  '03': { from: 'on-03-dangan', edit: 'monthPlan' },
  '04': { from: 'on-04-plan', edit: 'topicHit' },
  '06': { from: 'on-05-topic-open', edit: 'script' },
  '05': { from: 'on-06-assets', edit: 'assets' },
  '07': { from: 'on-07-store-page', edit: 'reshoot' },
  '08': { from: 'on-08-publish', edit: 'publish' },
  '09': { from: 'on-04-plan', edit: 'noReview' },
};

const V1 = {
  shots: [
    { t: '0–3 秒', d: `字幕：「四个人吃火锅 <span style="${HL}">238</span> 能吃成这样？」`, src: '满桌·四人餐' },
    { t: '3–9 秒', d: `上菜特写：<span style="${HL}">鲜毛肚</span>、<span style="${HL}">现切黄喉</span>、<span style="${HL}">手打虾滑</span>`, src: '菜·鲜毛肚' },
    { t: '9–17 秒', d: `手部现切黄喉，配字「<span style="${HL}">当天到当天切</span>」`, src: '手部·切黄喉' },
    { t: '17–25 秒', d: '夹起毛肚涮 8 秒，七上八下', miss: '缺这段，下一步教你拍', how: '竖着拿手机，离锅一个手掌，从上往下拍 · 8–10 秒' },
    { t: '25–30 秒', d: `门头 +「<span style="${HL}">建设路 68 号</span>，<span style="${HL}">四人餐 238</span> 团购在左下角」`, miss: '门头那段太横了，换一段竖的', how: '站在马路对面，竖着拍，慢慢往前走两步 · 5 秒' },
  ],
};

function inPage({ edit, V1, HL }) {
  const all = () => [...document.body.querySelectorAll('*')];
  // 文字正好等于 t 的最深元素
  const exact = (t) => all().filter((e) => e.textContent.trim() === t).pop();
  const up = (el, pred) => { while (el && !pred(el)) el = el.parentElement; return el; };
  const isCard = (e) => /\brounded/.test(e.className) && /\bborder\b/.test(e.className);
  const commonAncestor = (a, b) => { const s = new Set(); for (let x = a; x; x = x.parentElement) s.add(x); for (let y = b; y; y = y.parentElement) if (s.has(y)) return y; };
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const childOf = (anc, node) => { while (node && node.parentElement !== anc) node = node.parentElement; return node; };
  const cardCls = 'rounded-2xl border border-border bg-card p-4';
  const row = (k, v) => `<div class="flex justify-between gap-3 py-1 text-sm"><span class="text-muted-foreground">${k}</span><span class="text-right">${v}</span></div>`;
  const table = (head, rows) => `<table class="w-full text-sm"><thead><tr>${head.map((h) => `<th class="py-2 pr-2 text-left font-medium text-muted-foreground">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr class="border-t border-border">${r.map((c) => `<td class="py-2 pr-2 tabular-nums align-top">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const primaryBtn = (t) => `<button type="button" class="min-h-11 w-full rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">${t}</button>`;
  const outlineBtn = (t) => `<button type="button" class="min-h-11 w-full rounded-full border border-border bg-background px-4 text-sm font-medium">${t}</button>`;
  const replaceText = (from, html) => { const e = exact(from); if (e) e.innerHTML = html; return e; };

  // 演示店身份换成样例店；演示环境才有的「服务暂时不在线」条拿掉
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) if (n.nodeValue.includes('老街坊铜锅涮肉（演示店）')) n.nodeValue = n.nodeValue.replaceAll('老街坊铜锅涮肉（演示店）', '测试｜蜀香火锅(虚构)');
  exact('服务暂时不在线，新提交的单子会保留，恢复后自动继续。')?.remove();
  // 底栏拿掉「复盘」
  document.querySelector('nav button[aria-label="复盘"]')?.remove();

  const EDITS = {
    noReview() {},
    findStore() {
      const title = exact('先认识一下你的店');
      const sub = exact('店名和城市填好，就能聊聊生意。');
      const btn = up(exact('核对好了，下一步'), (e) => e.tagName === 'BUTTON');
      title.textContent = '找到你的店';
      sub.textContent = '我们找到了这家，对一下是不是你：';
      const box = commonAncestor(title, btn);
      const tChild = childOf(box, title), bChild = childOf(box, btn);
      let n = tChild.nextElementSibling;
      while (n && n !== bChild) { const next = n.nextElementSibling; n.remove(); n = next; }
      for (let x = bChild.nextElementSibling; x;) { const next = x.nextElementSibling; x.remove(); x = next; }
      tChild.after(el(`<div class="space-y-3">
        <section class="${cardCls}"><h2 class="text-base font-semibold">门店</h2>${row('店名', '蜀香火锅（建设路店）')}${row('地址', '成都 成华区 建设路 68 号')}${row('卖什么', '川味火锅')}${row('人均', '98 元')}${row('营业时间', '11:00–14:30 · 17:00–23:00')}${row('招牌', '鲜毛肚 · 现切黄喉 · 手打虾滑')}</section>
        <section class="${cardCls}"><h2 class="text-base font-semibold">在卖的团购</h2>${table(['套餐', '团购价', '原价', '已卖'], [['双人餐', '79', '218', '520+'], ['四人餐', '238', '426', '40+']])}</section></div>`));
      btn.textContent = '对，就是我家';
      btn.removeAttribute('disabled');
      btn.after(el(`<div class="mt-2">${outlineBtn('有不对的，我改')}</div>`));
    },
    threeQuestions() {
      const q = exact('先说说：店里现在生意怎么样——忙不忙、有没有明显的淡旺时段，随便说说就行。');
      const botRow = up(q, (e) => e.tagName === 'DIV' && e.querySelector('img'));
      const turn = botRow.parentElement;
      const opts = turn.querySelector('[aria-label="可选回答"]');
      const optTpl = opts.querySelector('button').cloneNode(true);
      const list = turn.parentElement;
      const bot = (text) => { const r = botRow.cloneNode(true); r.querySelector('output').textContent = text; return r; };
      const me = (text) => el(`<div class="enter-fade-up flex justify-end"><p class="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl bg-primary px-4 py-2 text-sm leading-6 text-primary-foreground">${text}</p></div>`);
      const options = (items) => { const o = opts.cloneNode(false); items.forEach((t) => { const b = optTpl.cloneNode(true); b.value = t; b.querySelector('span').textContent = t; o.append(b); }); return o; };
      const calc = el(`<div class="ml-10 mt-2 max-w-[85%] rounded-2xl border border-border bg-card p-4">
        ${row('双人餐菜单原价', '218 元')}${row('食材大概占几成', '4 成')}${row('平台抽成', '6%')}${row('达人佣金（没有填 0）', '15%')}
        <div class="mt-2 border-t border-border pt-2">${row('算出来不亏的最低价', '<b>111 元</b>')}${row('你能接受的最低价', '99 元')}</div>
        <p class="mt-2 text-sm font-medium text-destructive">现在卖 79 元，每单亏 30 多</p></div>`);
      list.replaceChildren(
        bot('1　最近生意，最头疼的是哪件？'), me('卖得不少，就是不赚钱'),
        bot('2　卖得最多的双人餐，你觉得是？'), me('好像在亏'),
        bot('3　算一下团购最低能卖多少'), calc, options(['好了，出诊断']),
      );
    },
    monthPlan() {
      const agree = exact('同意，就按这个');
      const card = up(agree, (e) => isCard(e) && e.textContent.includes('本月目标'));
      card.replaceWith(el(`<div class="space-y-3">
        <section class="${card.className}"><h2 class="text-base font-semibold">这个月的方案</h2><p class="mt-2 text-sm"><b>这个月先做：卖了能赚到钱</b><br>双人餐卖 79，你自己定的底线是 99，卖得越多亏得越多。</p></section>
        <section class="${card.className}"><h2 class="text-base font-semibold">团购方案</h2>${table(['套餐', '现在', '建议', '什么时候用'], [['双人餐', '79', '99，换掉一份黄喉加虾滑', '工作日，每天限 20 份'], ['四人餐', '238', '不动，主推', '全天']])}<p class="mt-2 text-sm text-muted-foreground">达人带的单子佣金重谈到 10% 以内，谈不下来先停。</p></section>
        <section class="${card.className}"><h2 class="text-base font-semibold">账号拍什么</h2>${row('方向', '四人餐上桌、现切、加点的菜')}${row('拍给谁', '建设路附近能来店的人')}${row('这个月', '4 条')}</section>
        <section class="${card.className}"><h2 class="text-base font-semibold">顺手一招</h2><p class="mt-1 text-sm">自己的号每周发一条，挂四人餐，少付达人佣金。</p></section>
        ${primaryBtn('就这么办')}${outlineBtn('不对，我说一下')}</div>`));
    },
    topicHit() {
      replaceText('一碗麻酱，决定我想不想再涮下一筷子', '四个人吃火锅 238 能吃成这样？');
      const desc = replaceText('把“麻酱每天店里现调”作为单一卖点，让顾客看到蘸料在涮肉体验里的角色。', '拍四人餐上桌、现切、加点的菜，开头直接报价。');
      desc.after(el(`<div class="mt-3 flex gap-3 rounded-2xl bg-muted p-3">
        <div class="rounded-xl" style="width:54px;height:72px;flex:none;background:linear-gradient(160deg,#c2410c,#7c2d12)"></div>
        <div class="text-sm"><p class="font-medium">照这条爆款 · 12.6 万赞</p><p class="text-muted-foreground">「四个人吃火锅 238 能吃成这样？」@成都吃货阿杰 · 10 天前</p><p class="mt-1">为什么适合你：同是四人套餐、同城，开头直接报价，正好推你的四人餐。</p></div></div>`));
      desc.nextElementSibling.after(el(`<p class="mt-2 text-sm"><span class="text-muted-foreground">对标账号</span>　@川渝火锅研究所 · 46 万粉　@社区火锅小店 · 3 万粉</p>`));
    },
    script() {
      replaceText('一碗麻酱，决定我想不想再涮下一筷子', '四个人吃火锅 238 能吃成这样？');
      [...document.querySelectorAll('*')].filter((e) => e.textContent.trim() === '一碗麻酱，决定我想不想再涮下一筷子').forEach((e) => { e.textContent = '四个人吃火锅 238 能吃成这样？'; });
      [...document.querySelectorAll('*')].filter((e) => e.textContent.trim() === '把“麻酱每天店里现调”作为单一卖点，让顾客看到蘸料在涮肉体验里的角色。').forEach((e) => { e.textContent = '拍四人餐上桌、现切、加点的菜，开头直接报价。'; });
      const head = exact('镜头与口播');
      head.before(el(`<div class="mb-3 grid grid-cols-2 rounded-full bg-muted p-1 text-sm"><div class="rounded-full py-2 text-center text-muted-foreground">爆款原版</div><div class="rounded-full bg-background py-2 text-center font-semibold">你家的版本</div></div>`));
      const OLD = [
        ['0–5秒', '麻酱碗超近景；需要补拍麻酱表面和搅动纹理。', '勺子从碗边慢慢搅一圈，拉出浓稠感。', '吃铜锅涮肉，我真的会先看这一碗麻酱。'],
        ['5–12秒', '员工把麻酱放到桌上；需要补拍桌面递送动作。', '把麻酱碗轻轻放在铜锅旁边。', '测试｜蜀香火锅(虚构)的麻酱，是每天在店里现调的。'],
        ['12–18秒', '铜锅里涮羊肉卷；需要补拍锅内涮肉动作。', '筷子夹着羊肉卷在锅里轻涮，保持画面干净清楚。', '羊肉卷下进炭火铜锅，等的就是捞起来蘸那一下。'],
        ['18–23秒', '肉片蘸麻酱特写；需要补拍员工演示，不冒充顾客评价。', '夹起肉片，蘸麻酱后停留半秒。', '热乎的肉，裹上麻酱，香气一下就有了。'],
        ['23–31秒', '店门或桌面全景；需要补拍店内一桌铜锅场景。', '从麻酱拉远到整口铜锅和桌面。', '想吃这口，在深圳南山区桃园路88号，测试｜蜀香火锅(虚构)。'],
      ];
      OLD.forEach(([t, d, a, line], i) => {
        const s = V1.shots[i];
        const dEl = exact(d);
        replaceText(t, s.t);
        dEl.innerHTML = s.d;
        exact(a)?.remove();
        const lineEl = exact(line);
        const tag = s.miss ? `<p class="mt-1 text-sm font-medium text-destructive">${s.miss}</p>` : `<p class="mt-1 text-sm text-muted-foreground">用你的素材：${s.src}</p>`;
        if (lineEl) lineEl.replaceWith(el(tag)); else dEl.after(el(tag));
      });
    },
    assets() {
      const item = up(exact('一碗麻酱，决定我想不想再涮下一筷子.mp4'), (e) => e.textContent.includes('下载') && e.textContent.includes('MB'));
      const list = [['菜·鲜毛肚', '已调亮'], ['门头', '已裁竖屏'], ['满桌·四人餐', '已防抖'], ['手部·切黄喉', '可直接用'], ['店里·晚市', '太暗，不用', 1], ['有客人的脸', '要客人同意', 1]];
      const tpl = item.cloneNode(true);
      let prev = item;
      list.forEach(([name, state, bad], i) => {
        const c = i === 0 ? item : tpl.cloneNode(true);
        const nameEl = [...c.querySelectorAll('*')].filter((e) => e.textContent.trim().endsWith('.mp4')).pop();
        nameEl.textContent = name;
        nameEl.after(el(`<p class="mt-1 text-sm"><span class="rounded-full bg-muted px-2 py-0.5">${name.split('·')[0]}</span> <span class="${bad ? 'text-destructive font-medium' : 'text-muted-foreground'}">${state}</span></p>`));
        if (i > 0) { prev.after(c); prev = c; }
      });
      const count = exact('2 份素材'); if (count) count.textContent = '7 份素材';
      prev.parentElement.after(el(`<div class="mt-4 space-y-2">${outlineBtn('再传几段')}${primaryBtn('好了，下一步')}</div>`));
      const lib = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().startsWith('视频库'));
      const num = lib && [...lib.querySelectorAll('*')].filter((e) => e.textContent.trim() === '1').pop();
      if (num) num.textContent = '6';
      const cur = [...document.querySelectorAll('*')].filter((e) => e.textContent.trim() === '当前选片：一碗麻酱，决定我想不想再涮下一筷子').pop();
      if (cur) cur.textContent = '当前选片：四个人吃火锅 238 能吃成这样？';
    },
    reshoot() {
      replaceText('这周拍这个', '还差 2 段就能出片');
      const title = exact('一碗麻酱，决定我想不想再涮下一筷子');
      title.textContent = '四个人吃火锅 238 能吃成这样？ · 5 段里配上了 3 段';
      const items = [...document.querySelectorAll('ol > li')].filter((li) => li.querySelector('button'));
      items.forEach((li, i) => {
        const s = V1.shots[i];
        if (!s) return;
        const [descP, howP, sayP] = li.querySelectorAll('p');
        descP.innerHTML = `<span class="mr-2 text-muted-foreground">${s.t}</span>${s.d.replace(/<span[^>]*>|<\/span>/g, '')}`;
        if (s.miss) howP.textContent = `怎么拍：${s.how}`; else howP.remove();
        sayP?.remove();
        const b = li.querySelector('button');
        if (s.miss) b.textContent = '拍好了，上传';
        else b.replaceWith(el(`<p class="mt-2 text-sm text-muted-foreground">✓ 已配上：${s.src}</p>`));
      });
      items[items.length - 1].parentElement.after(el(`<button type="button" disabled class="mt-4 min-h-11 w-full rounded-full bg-muted px-4 text-sm font-medium text-muted-foreground">出片（还差 2 段）</button>`));
    },
    publish() {
      [...document.querySelectorAll('*')].filter((e) => e.textContent.trim() === '一碗麻酱，决定我想不想再涮下一筷子').forEach((e) => { e.textContent = '四个人吃火锅 238 能吃成这样？'; });
      const label = exact('发布配文');
      const box = label.nextElementSibling || label.parentElement.nextElementSibling;
      const ta = box?.matches('textarea') ? box : box?.querySelector('textarea');
      (ta || box).textContent = '四个人吃火锅 238 能吃成这样？鲜毛肚、现切黄喉、手打虾滑，当天到当天切。建设路的朋友冲！\n#成都火锅 #建设路美食 #火锅探店 #四人餐';
      (box || label).after(el(`<div class="mt-3 rounded-2xl border border-border p-3">${row('挂团购', '四人餐 238')}${row('地点', '蜀香火锅（建设路店）')}${row('什么时候发', '周五 17:30')}</div>`));
    },
  };
  EDITS[edit]();
}

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true })).newPage();
for (const [k, { from, edit }] of Object.entries(STEPS)) {
  const src = join(HERE, 'now', `${from}.html`);
  if (!existsSync(src)) { console.log(`skip ${k}: no ${from}.html`); continue; }
  let html = readFileSync(src, 'utf8')
    .replace(/<script\b[\s\S]*?<\/script>/g, '')
    .replace(/<link[^>]+rel="(?:modulepreload|preload)"[^>]*>/g, '')
    .replace(/\/_next\/static\/css\//g, '../css/')
    .replace(/\/_next\/image\?url=%2Flogo\.png&amp;w=\d+&amp;q=\d+/g, '../logo.png')
    .replace('<head>', `<head><base href="${BASE}">`);
  await page.setContent(html, { waitUntil: 'load' });
  try {
    await page.evaluate(inPage, { edit, V1, HL });
  } catch (e) { console.log(`FAIL ${k} (${edit}): ${e.message.split('\n')[0]}`); continue; }
  const out = (await page.content()).replace(`<base href="${BASE}">`, '');
  writeFileSync(join(HERE, 'after', `${k}.html`), out);
  console.log(`ok ${k} <- ${from}`);
}
await browser.close();
