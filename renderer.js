import { STATUS } from './data.js';

export const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.flat().filter(x => x != null && x !== false));
  return e;
};

const money = n => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
export const fmt = { money };
export const date = iso => h('time', { datetime: iso, text: new Date(iso).toLocaleDateString('ru-RU') });
export const badge = s => h('span', { class: 'badge', 'data-tone': STATUS[s] || 'info', text: s });
const P = { high: ['▲', 'Высокий'], medium: ['●', 'Средний'], low: ['▼', 'Низкий'] };
export const prio = p => h('span', { class: 'prio', 'data-p': p }, h('span', { 'aria-hidden': 'true', text: P[p][0] }), ` ${P[p][1]}`);
const open = i => h('button', { class: 'link', type: 'button', 'data-open': i.id, text: i.title });

export const card = i => h('article', { class: 'card' },
  h('header', {}, h('span', { class: 'id', text: i.id }), badge(i.status)),
  h('h3', {}, open(i)),
  h('p', { text: i.description }),
  h('dl', {}, h('dt', { text: 'Сумма' }), h('dd', { text: money(i.amount) }), h('dt', { text: 'Ответственный' }), h('dd', { text: i.owner })),
  h('footer', {}, date(i.date), prio(i.priority), h('ul', { class: 'tags' }, i.tags.map(t => h('li', { text: t })))));

const COLS = [['id', 'ID'], ['title', 'Название'], ['kind', 'Тип'], ['status', 'Статус'], ['priority', 'Приоритет'], ['date', 'Дата'], ['amount', 'Сумма']];
const CELL = { id: i => i.id, title: open, kind: i => i.kind, status: i => badge(i.status), priority: i => prio(i.priority), date: i => date(i.date), amount: i => money(i.amount) };

export const table = (items, sort, caption) => h('div', { class: 'wrap' }, h('table', {},
  h('caption', { text: caption }),
  h('thead', {}, h('tr', {}, COLS.map(([k, l]) => h('th', { scope: 'col', 'aria-sort': sort.key === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none' },
    h('button', { class: 'sort', type: 'button', 'data-sort': k }, l, h('span', { class: 'arrow', 'aria-hidden': 'true', text: sort.key === k ? (sort.dir > 0 ? '▲' : '▼') : '↕' })))))),
  h('tbody', {}, items.map(i => h('tr', {}, COLS.map(([k, l], n) => h(n ? 'td' : 'th', { scope: n ? null : 'row', 'data-label': l }, CELL[k](i))))))));

export const empty = () => h('section', { class: 'empty' }, h('span', { 'aria-hidden': 'true', text: '🗂' }), h('h3', { text: 'Ничего не найдено' }), h('p', { text: 'Измените условия поиска или сбросьте фильтры.' }));
export const skeleton = () => h('ul', { class: 'cards', 'aria-hidden': 'true' }, Array.from({ length: 6 }, () => h('li', { class: 'sk' })));

export const detail = i => h('dl', { class: 'detail' },
  Object.entries({ 'ID': i.id, 'Описание': i.description, 'Тип': i.kind, 'Сумма': money(i.amount), 'Ответственный': i.owner, ...i.details })
    .flatMap(([k, v]) => [h('dt', { text: k }), h('dd', {}, /^\d{4}-\d\d-\d\d$/.test(v) ? date(v) : v)]),
  h('dt', { text: 'Статус' }), h('dd', {}, badge(i.status)),
  h('dt', { text: 'Приоритет' }), h('dd', {}, prio(i.priority)),
  h('dt', { text: 'Дата' }), h('dd', {}, date(i.date)),
  h('dt', { text: 'Теги' }), h('dd', { text: i.tags.join(', ') }));

export const field = (id, label, attrs = {}) => h('p', { class: 'field' },
  h('label', { for: id, text: label }),
  h('input', { id, name: id, 'aria-describedby': id + '-e', ...attrs }),
  h('small', { class: 'err', id: id + '-e' }));

export const opt = (type, name, value, text, id) => [
  h('input', { class: 'sr', type, name, value, id }),
  h('label', { class: 'opt ' + (type === 'radio' ? 'radio' : 'check'), for: id, text })];