import { ENTITIES, DATA, STATUS } from './data.js';
import { h, fmt, card, table, empty, skeleton, detail, field, opt } from './renderer.js';

const $ = s => document.querySelector(s);
const root = document.documentElement;
const panel = $('#panel'), form = $('#filters'), modal = $('#modal');
let tab = 'invoices', sort = { key: 'date', dir: -1 }, loadTimer, inputTimer, valTimer, lastFocus;

/* ---------- данные и фильтры ---------- */
const filters = () => {
  const f = new FormData(form);
  return { q: (f.get('q') || '').trim().toLowerCase(), kind: f.get('kind') || '', st: f.getAll('st'), view: f.get('view') };
};

const visible = () => {
  const { q, kind, st } = filters(), { key, dir } = sort;
  return DATA[tab]
    .filter(i => (!kind || i.kind === kind) && (!st.length || st.includes(i.status)) &&
      (!q || `${i.id} ${i.title} ${i.description}`.toLowerCase().includes(q)))
    .sort((a, b) => (typeof a[key] === 'number' ? a[key] - b[key] : String(a[key]).localeCompare(b[key], 'ru')) * dir);
};

const buildFilters = () => {
  const uniq = k => [...new Set(DATA[tab].map(i => i[k]))];
  $('#kind').replaceChildren(h('option', { value: '', text: 'Все' }), ...uniq('kind').map(k => h('option', { value: k, text: k })));
  $('#statuses').replaceChildren(h('legend', { text: 'Статус' }), ...uniq('status').flatMap((s, n) => opt('checkbox', 'st', s, s, 'st' + n)));
};

const render = () => {
  const items = visible(), f = filters();
  panel.replaceChildren(!items.length ? empty()
    : f.view === 'table' ? table(items, sort, ENTITIES[tab].label)
    : h('ul', { class: 'cards' }, items.map(i => h('li', {}, card(i)))));
  $('#reset').disabled = !(f.q || f.kind || f.st.length);
};

/* ---------- отчёт со счётчиками ---------- */
const anim = (el, to, f) => {
  const t0 = performance.now();
  const step = t => { const p = Math.min((t - t0) / 600, 1); el.textContent = f(Math.round(to * p)); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
};
const stats = () => {
  const d = DATA[tab];
  const rows = [
    ['Записей', d.length, String],
    ['Общая сумма', d.reduce((s, i) => s + i.amount, 0), fmt.money],
    ['Требуют внимания', d.filter(i => ['warning', 'danger'].includes(STATUS[i.status])).length, String]
  ];
  $('#stats').replaceChildren(...rows.map(([l, v, f]) => {
    const dd = h('dd', { text: f(0) }); anim(dd, v, f);
    return h('div', { class: 'stat' }, h('dt', { text: l }), dd);
  }));
};

/* ---------- вкладки ---------- */
const setTab = t => {
  tab = t; sort = { key: 'date', dir: -1 };
  buildFilters();
  document.querySelectorAll('[data-tab]').forEach(b => {
    const on = b.dataset.tab === t;
    if (b.matches('[role=tab]')) { b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; }
    else if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $('#mt').textContent = ENTITIES[t].label;
  panel.setAttribute('aria-labelledby', 'tab-' + t);
  panel.replaceChildren(skeleton());
  clearTimeout(loadTimer); loadTimer = setTimeout(render, 600);
  stats();
};

$('[role=tablist]').addEventListener('keydown', e => {
  const tabs = [...e.currentTarget.children], i = tabs.indexOf(document.activeElement);
  const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
  if (n == null) return;
  e.preventDefault();
  const b = tabs[(n + tabs.length) % tabs.length]; b.focus(); setTab(b.dataset.tab);
});

/* делегирование событий */
document.addEventListener('click', e => {
  if (e.target.closest('nav a')) menu(false);
  const t = e.target.closest('[data-tab]'); if (t) setTab(t.dataset.tab);
});
panel.addEventListener('click', e => {
  const o = e.target.closest('[data-open]'), s = e.target.closest('[data-sort]');
  if (o) openDetail(DATA[tab].find(i => i.id === o.dataset.open));
  if (s) {
    const k = s.dataset.sort; sort = { key: k, dir: sort.key === k ? -sort.dir : 1 };
    render(); panel.querySelector(`[data-sort="${k}"]`)?.focus();
  }
});
form.addEventListener('input', e => { clearTimeout(inputTimer); inputTimer = setTimeout(render, e.target.id === 'q' ? 250 : 0); });
form.addEventListener('reset', () => setTimeout(render));
form.addEventListener('submit', e => e.preventDefault());

/* ---------- модальное окно ---------- */
const openModal = (title, body, footer) => {
  lastFocus = document.activeElement;
  modal.replaceChildren(
    h('header', {}, h('h2', { id: 'mTitle', text: title }), h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Закрыть', 'data-close': true, text: '✕' })),
    h('section', { class: 'mbody' }, body),
    h('footer', {}, ...footer));
  document.body.style.overflow = 'hidden';
  modal.showModal();
};
modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-close]')) modal.close(); });
modal.addEventListener('close', () => { document.body.style.overflow = ''; lastFocus?.focus(); });
modal.addEventListener('keydown', e => { // focus trap (Escape обрабатывает <dialog>)
  if (e.key !== 'Tab') return;
  const f = [...modal.querySelectorAll('button,input,select,textarea,a[href]')].filter(x => !x.disabled);
  const a = f[0], z = f.at(-1);
  if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
  else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
});
const openDetail = i => openModal(i.title, detail(i), [h('button', { class: 'btn primary', type: 'button', 'data-close': true, text: 'Закрыть' })]);

/* ---------- форма с валидацией ---------- */
const RULES = {
  title: v => !v ? 'Укажите название' : v.length < 5 ? 'Минимум 5 символов' : '',
  amount: v => !v ? 'Укажите сумму' : !(+v > 0) ? 'Сумма должна быть больше 0' : '',
  email: v => !v ? 'Укажите email' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Неверный формат email' : ''
};
const check = el => {
  const m = RULES[el.name](el.value.trim());
  el.setAttribute('aria-invalid', !!m); $('#' + el.id + '-e').textContent = m;
  return !m;
};
const openForm = () => {
  const f = h('form', { id: 'addForm', novalidate: true },
    field('title', 'Название', { type: 'text', required: true, autocomplete: 'off' }),
    field('amount', 'Сумма, ₽', { type: 'number', min: 1, required: true, inputmode: 'numeric' }),
    field('email', 'Email ответственного', { type: 'email', required: true }));
  f.addEventListener('focusout', e => e.target.name && check(e.target));
  f.addEventListener('input', e => { clearTimeout(valTimer); valTimer = setTimeout(() => e.target.name && check(e.target), 400); });
  f.addEventListener('submit', e => {
    e.preventDefault();
    const els = [...f.elements].filter(x => x.name), bad = els.filter(x => !check(x));
    if (bad.length) return bad[0].focus();
    const v = Object.fromEntries(els.map(x => [x.name, x.value.trim()])), p = ENTITIES[tab];
    DATA[tab].unshift({
      id: `${p.prefix}-${String(DATA[tab].length + 1).padStart(3, '0')}`, title: v.title, description: 'Добавлено вручную',
      kind: DATA[tab][0].kind, status: p.status, priority: 'medium', date: new Date().toISOString().slice(0, 10),
      amount: +v.amount, owner: 'Вы', tags: ['Новое'], details: { 'Email': v.email }
    });
    modal.close(); buildFilters(); render(); stats(); toast('Запись добавлена');
  });
  openModal('Новая запись', f, [
    h('button', { class: 'btn', type: 'button', 'data-close': true, text: 'Отмена' }),
    h('button', { class: 'btn primary', type: 'submit', form: 'addForm', text: 'Сохранить' })]);
  $('#title').focus();
};
$('#add').addEventListener('click', openForm);

/* ---------- toast ---------- */
const toast = msg => {
  const t = h('p', { class: 'toast', role: 'status', text: msg });
  $('#toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3500);
};

/* ---------- мобильное меню ---------- */
const menu = open => {
  document.body.classList.toggle('menu-open', open);
  const b = $('#menuBtn'); b.setAttribute('aria-expanded', open); b.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
};
$('#menuBtn').addEventListener('click', () => menu(!document.body.classList.contains('menu-open')));
$('#overlay').addEventListener('click', () => menu(false));
document.addEventListener('keydown', e => e.key === 'Escape' && menu(false));

/* ---------- темы и акцентный цвет ---------- */
const sysDark = matchMedia('(prefers-color-scheme: dark)');
const sysTheme = () => sysDark.matches ? 'dark' : 'light';
const themeSel = $('#theme'); themeSel.value = localStorage.getItem('theme') || 'auto';
themeSel.addEventListener('change', () => {
  const v = themeSel.value;
  if (v === 'auto') { localStorage.removeItem('theme'); root.dataset.theme = sysTheme(); }
  else { localStorage.setItem('theme', v); root.dataset.theme = v; }
});
sysDark.addEventListener('change', () => { if (!localStorage.getItem('theme')) root.dataset.theme = sysTheme(); });
const acc = $('#accent'); acc.value = localStorage.getItem('accent') || '#2563eb';
acc.addEventListener('input', () => {
  const hex = acc.value;
  root.style.setProperty('--accent', hex);
  root.style.setProperty('--accent-rgb', [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16)).join(','));
  localStorage.setItem('accent', hex);
});

setTab('invoices');