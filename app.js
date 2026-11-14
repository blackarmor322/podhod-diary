const seed = [["chest-press","Грудь","Жим",null,null,null,false],["chest-dumbbell","Грудь","Гантели",null,null,null,false],["chest-fly","Грудь","Бабочка",null,null,null,false],["biceps-machine","Бицепс","Тренажёр",null,null,null,false],["biceps-bar","Бицепс","Гриф",null,null,null,false],["biceps-dumbbell","Бицепс","Гантели сидя",null,null,null,false],["biceps-hammer","Бицепс","Молотки",null,null,null,false],["back-pullups","Спина","Подтягивания",null,null,null,true],["back-unnamed","Спина",null,null,null,null,false],["back-row","Спина","Тяга блока к себе",null,null,null,false],["back-machine-pull","Спина","Тяга в тренажёре (вверх)",null,null,null,false],["shoulder-raises","Плечи","Махи",null,null,null,false],["shoulder-cable-raises","Плечи","Махи в блоке",null,null,null,false],["shoulder-up","Плечи","Вверх",null,null,null,false],["triceps-rope","Трицепс","Верёвка в блоке",null,null,null,false],["triceps-behind","Трицепс","Блок со спины",null,null,null,false],["triceps-metal","Трицепс","Железная",null,null,null,false],["legs-up","Ноги","Тяга вверх",null,null,null,false],["legs-machine-extension","Ноги","Тренажёр разгибание",null,null,null,false],["legs-squat","Ноги","Присед",null,null,null,false],["legs-extension","Ноги","Разгибание",null,null,null,false],["traps-dumbbell","Трапеция","Гантели",null,null,null,false],["abs-machine","Пресс","Тренажёр",null,null,null,false]];
const byId = id => document.getElementById(id);
const storageKey = 'podhod.workout-entries.v1';
const starterKey = 'podhod.starter-values.v1';
const exercises = seed.map(([id, group, name, weight, sets, reps, bodyweight = false, singleSetReps]) =>
  ({ id, group, name, weight, sets, reps, bodyweight, singleSetReps }));
const exerciseById = new Map(exercises.map(item => [item.id, item]));
const groups = [...new Set(exercises.map(exercise => exercise.group))];
const group = byId('group');
const exercise = byId('exercise');
const progressGroup = byId('progress-group');
const progressExercise = byId('progress-exercise');
const weight = byId('weight');
const sets = byId('sets');
const reps = byId('reps');
const date = byId('date');
const nameField = byId('exercise-name');
const formError = byId('form-error');
const notice = byId('notice');
const save = byId('save');
const chart = byId('chart');
const pointSelect = byId('chart-point');
const formatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 });
const dateFormatter = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' });
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
let entries = [];
let storageReady = false;
let editing = null;
let activePage = 'record';
let chartPoints = [];
let pointPositions = [];
let chartUnit = 'кг';
let starterValues = new Map();

function restoreEntries() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(value)) throw new Error('Invalid journal');
    entries = value;
    storageReady = true;
  } catch {
    showError('Не удалось прочитать журнал на этом устройстве.');
  }
}

function persistEntries(nextEntries) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(nextEntries));
    entries = nextEntries;
    return true;
  } catch {
    return false;
  }
}

function today() {
  const now = new Date();
  const pad = number => String(number).padStart(2, '0');
  return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = !message;
}

function description(entry) {
  return [
    entry.weight === null ? null : formatter.format(entry.weight) + ' кг',
    entry.sets === null ? null : entry.sets + ' подх.',
    entry.reps === null ? null : entry.reps + ' повт. всего'
  ].filter(Boolean).join(' · ');
}

function starterFor(item) {
  return { ...item, ...starterValues.get(item.id) };
}

function recentRecord(id) {
  return [...entries].filter(entry => entry.exerciseId === id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt)[0];
}

function exerciseName(item) {
  return item.name ?? recentRecord(item.id)?.name ?? starterFor(item).name ?? 'Без названия';
}

function replaceOptions(select, choices, preferred) {
  select.replaceChildren(...choices.map(([value, label]) => new Option(label, value)));
  if (choices.some(([value]) => value === preferred)) select.value = preferred;
}

function fillExercises(groupSelect, exerciseSelect, preferred) {
  replaceOptions(exerciseSelect, exercises.filter(item => item.group === groupSelect.value)
    .map(item => [item.id, exerciseName(item)]), preferred);
}

function fillForm(preferredEntry) {
  const item = exercises.find(item => item.id === exercise.value);
  if (!item) return;
  const last = recentRecord(item.id);
  const starter = starterFor(item);
  const values = preferredEntry ?? last ?? starter;
  byId('name-row').hidden = item.name !== null;
  nameField.required = item.name === null;
  nameField.value = values.name ?? '';
  weight.value = values.weight === null ? '' : String(values.weight).replace('.', ',');
  weight.required = !item.bodyweight;
  sets.value = values.sets ?? '';
  reps.value = values.reps ?? '';
  if (preferredEntry) date.value = preferredEntry.date;
  const reference = byId('reference');
  const originalReps = !last && starter.singleSetReps ? ' · в исходном списке ' + starter.singleSetReps + ' повт.' : '';
  const initialDescription = description(last ?? starter);
  reference.textContent = (last ? 'Последняя запись · ' : 'Стартовые показатели · ') + initialDescription + originalReps;
  reference.hidden = !initialDescription && !originalReps;
  showError('');
}

function useEntry(entry) {
  editing = entry?.id ?? null;
  byId('record-title').textContent = editing ? 'Редактировать' : 'Запись';
  byId('cancel-edit').hidden = !editing;
  save.textContent = editing ? 'Сохранить изменения' : 'Сохранить запись';
  if (entry) {
    const item = exercises.find(item => item.id === entry.exerciseId);
    group.value = item.group;
    fillExercises(group, exercise, item.id);
  } else {
    date.value = today();
  }
  fillForm(entry);
}

function openPage(page) {
  if (page === 'progress' && activePage === 'record') {
    progressGroup.value = group.value;
    fillExercises(progressGroup, progressExercise, exercise.value);
  }
  activePage = page;
  for (const button of document.querySelectorAll('[data-page]')) {
    const selected = button.dataset.page === page;
    byId(button.dataset.page + '-page').hidden = !selected;
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  if (page === 'progress') renderProgress();
  if (page === 'journal') renderJournal();
  window.scrollTo({ top: 0 });
}

function readRecord() {
  const item = exercises.find(item => item.id === exercise.value);
  const weightText = weight.value.trim().replace(',', '.');
  const weightValue = weightText ? Number(weightText) : null;
  const dateValue = date.value;
  const parsedDate = new Date(dateValue);
  if (!item) return ['Выбери упражнение.', exercise];
  if (item.name === null && !nameField.value.trim()) return ['Введи название упражнения.', nameField];
  if ((weightValue === null && !item.bodyweight) || (weightText && (!/^\d{1,4}(\.\d{1,3})?$/.test(weightText) || weightValue > 9999)))
    return ['Введи вес в килограммах, например 17,5.', weight];
  if (!/^\d{1,3}$/.test(sets.value) || Number(sets.value) < 1) return ['Введи число подходов.', sets];
  if (!/^\d{1,4}$/.test(reps.value) || Number(reps.value) < 1) return ['Введи общее число повторений.', reps];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !Number.isFinite(parsedDate.valueOf()) ||
      parsedDate.toISOString().slice(0, 10) !== dateValue || dateValue < '1900-01-01')
    return ['Выбери дату тренировки.', date];
  return {
    id: editing ?? (globalThis.crypto.randomUUID?.() ?? 'entry-' + Date.now() + '-' + Math.random().toString(36).slice(2)),
    exerciseId: item.id, name: item.name ?? nameField.value.trim(), date: dateValue,
    weight: item.bodyweight && weightValue === 0 ? null : weightValue,
    sets: Number(sets.value), reps: Number(reps.value), updatedAt: Date.now()
  };
}

byId('record-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!storageReady || save.disabled) return;
  const entry = readRecord();
  if (Array.isArray(entry)) {
    showError(entry[0]);
    entry[1].focus();
    return;
  }
  const nextEntries = [...entries.filter(previous => previous.id !== entry.id), entry];
  if (!persistEntries(nextEntries)) {
    showError('Не удалось сохранить запись на устройстве. Попробуй ещё раз.');
    return;
  }
  fillExercises(group, exercise, entry.exerciseId);
  useEntry(null);
  notice.textContent = 'Сохранено · ' + entry.name + ' · ' + description(entry);
  save.disabled = true;
});

byId('record-form').addEventListener('input', () => {
  save.disabled = !storageReady;
  notice.textContent = '';
  showError('');
});
group.addEventListener('change', () => {
  fillExercises(group, exercise);
  fillForm();
  save.disabled = !storageReady;
  notice.textContent = '';
});
exercise.addEventListener('change', () => {
  fillForm();
  save.disabled = !storageReady;
  notice.textContent = '';
});
byId('cancel-edit').addEventListener('click', () => {
  useEntry(null);
  openPage('journal');
});
progressGroup.addEventListener('change', () => { fillExercises(progressGroup, progressExercise); renderProgress(); });
progressExercise.addEventListener('change', renderProgress);

function renderJournal() {
  const list = byId('journal-list');
  list.replaceChildren();
  byId('journal-empty').hidden = entries.length > 0;
  const days = new Map();
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
  for (const entry of sorted) {
    if (!days.has(entry.date)) days.set(entry.date, []);
    days.get(entry.date).push(entry);
  }
  for (const [day, records] of days) {
    const heading = document.createElement('h2');
    heading.className = 'day-title';
    heading.textContent = dateFormatter.format(new Date(day + 'T12:00:00'));
    const section = document.createElement('div');
    section.className = 'surface';
    for (const entry of records) {
      const row = document.createElement('article');
      row.className = 'entry';
      const details = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = entry.name;
      const values = document.createElement('p');
      values.textContent = description(entry);
      details.append(name, values);
      const actions = document.createElement('div');
      actions.className = 'entry-actions';
      const change = document.createElement('button');
      change.type = 'button';
      change.textContent = 'Править';
      change.setAttribute('aria-label', 'Править запись: ' + entry.name);
      change.addEventListener('click', () => {
        notice.textContent = '';
        useEntry(entry);
        save.disabled = !storageReady;
        openPage('record');
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete';
      remove.textContent = 'Удалить';
      remove.setAttribute('aria-label', 'Удалить запись: ' + entry.name);
      remove.addEventListener('click', () => {
        if (!window.confirm('Удалить запись «' + entry.name + '»?')) return;
        if (!persistEntries(entries.filter(previous => previous.id !== entry.id))) {
          window.alert('Не удалось удалить запись. Попробуй ещё раз.');
          return;
        }
        if (editing === entry.id) useEntry(null);
        renderJournal();
      });
      actions.append(change, remove);
      row.append(details, actions);
      section.append(row);
    }
    list.append(heading, section);
  }
}

function renderProgress() {
  const item = exercises.find(item => item.id === progressExercise.value);
  if (!item) return;
  const records = entries.filter(entry => entry.exerciseId === item.id);
  const hasWeight = records.some(entry => entry.weight !== null);
  const metric = !item.bodyweight || hasWeight ? 'weight' : 'reps';
  chartUnit = metric === 'weight' ? 'кг' : 'повт.';
  const days = new Map();
  for (const entry of records) {
    const value = entry[metric];
    if (value === null) continue;
    const previous = days.get(entry.date);
    if (!previous || value > previous.value || (value === previous.value && entry.updatedAt > previous.entry.updatedAt))
      days.set(entry.date, { value, entry });
  }
  chartPoints = [...days.values()].sort((a, b) => a.entry.date.localeCompare(b.entry.date));
  const empty = byId('progress-empty');
  empty.hidden = chartPoints.length > 0;
  const initialDescription = description(starterFor(item));
  empty.textContent = 'График появится после первой записи.' +
    (initialDescription ? ' Стартовые показатели · ' + initialDescription : '');
  byId('progress-summary').hidden = !chartPoints.length;
  if (!chartPoints.length) return;
  byId('chart-caption').textContent = metric === 'weight' ? 'Вес по датам' : 'Повторения по датам';
  byId('point-row').hidden = chartPoints.length < 2;
  replaceOptions(pointSelect, chartPoints.map(({ entry }, i) =>
    [String(i), dateFormatter.format(new Date(entry.date + 'T12:00:00'))]), String(chartPoints.length - 1));
  chart.setAttribute('aria-label', byId('chart-caption').textContent + ' · ' + exerciseName(item));
  renderSelectedPoint();
}

function renderSelectedPoint() {
  const point = chartPoints[Number(pointSelect.value)];
  if (!point) return;
  byId('chart-metric').textContent = formatter.format(point.value) + ' ' + chartUnit;
  byId('chart-details').textContent = dateFormatter.format(new Date(point.entry.date + 'T12:00:00')) + ' · ' + description(point.entry);
  drawChart();
}

function drawChart() {
  const rect = chart.getBoundingClientRect();
  if (!rect.width || !chartPoints.length) return;
  const { width, height } = rect;
  const scale = window.devicePixelRatio || 1;
  chart.width = Math.round(width * scale);
  chart.height = Math.round(height * scale);
  const ctx = chart.getContext('2d');
  ctx.scale(scale, scale);
  const values = chartPoints.map(point => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * .15, chartUnit === 'кг' ? .5 : 1);
  const low = Math.max(0, min - padding);
  const high = max + padding;
  const dates = chartPoints.map(point => Date.parse(point.entry.date));
  const left = 42, right = width - 14, top = 15, bottom = height - 30;
  const elapsed = dates.at(-1) - dates[0];
  pointPositions = values.map((value, i) => ({
    x: elapsed ? left + (dates[i] - dates[0]) / elapsed * (right - left) : (left + right) / 2,
    y: bottom - (value - low) / (high - low) * (bottom - top)
  }));
  ctx.font = '11px system-ui';
  ctx.textBaseline = 'middle';
  for (let index = 0; index < 5; index++) {
    const ratio = index / 4;
    const y = bottom - ratio * (bottom - top);
    ctx.strokeStyle = '#353b32';
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    ctx.fillStyle = '#aab1a5';
    ctx.fillText(formatter.format(Math.round((low + ratio * (high - low)) * 10) / 10), 0, y);
  }
  const firstDate = shortDate.format(new Date(chartPoints[0].entry.date + 'T12:00:00'));
  const endDate = shortDate.format(new Date(chartPoints.at(-1).entry.date + 'T12:00:00'));
  ctx.fillText(firstDate, elapsed ? left : (left + right - ctx.measureText(firstDate).width) / 2, height - 11);
  if (elapsed) ctx.fillText(endDate, right - ctx.measureText(endDate).width, height - 11);
  ctx.strokeStyle = '#d1fa70';
  ctx.lineWidth = 2;
  ctx.beginPath();
  pointPositions.forEach(({ x, y }, index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.stroke();
  pointPositions.forEach(({ x, y }, index) => {
    ctx.fillStyle = '#d1fa70';
    ctx.beginPath(); ctx.arc(x, y, index === Number(pointSelect.value) ? 6 : 3, 0, Math.PI * 2); ctx.fill();
  });
}

pointSelect.addEventListener('change', renderSelectedPoint);
chart.addEventListener('click', event => {
  if (!pointPositions.length) return;
  const x = event.clientX - chart.getBoundingClientRect().left;
  const index = pointPositions.reduce((nearest, point, i) =>
    Math.abs(point.x - x) < Math.abs(pointPositions[nearest].x - x) ? i : nearest, 0);
  pointSelect.value = String(index);
  renderSelectedPoint();
});
window.addEventListener('resize', () => { if (activePage === 'progress') drawChart(); });
window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== starterKey) return;
  if (event.key === storageKey) restoreEntries();
  else restoreStarter();
  if (activePage === 'journal') renderJournal();
  if (activePage === 'progress') renderProgress();
});
for (const button of document.querySelectorAll('[data-page]')) button.addEventListener('click', () => openPage(button.dataset.page));

const optionalWeight = value => value === null || (Number.isFinite(value) && value >= 0 && value <= 9999);
const positiveInteger = (value, max) => Number.isInteger(value) && value >= 1 && value <= max;
const validName = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 70;
function parseStarter(value) {
  const { id, name, weight, sets, reps, singleSetReps } = value ?? {};
  if (!exerciseById.has(id) || (name !== null && !validName(name)) || !optionalWeight(weight) ||
      (sets !== null && !positiveInteger(sets, 999)) || (reps !== null && !positiveInteger(reps, 9999)) ||
      (singleSetReps !== undefined && !positiveInteger(singleSetReps, 9999))) throw new Error('Invalid starter values');
  return { id, name, weight, sets, reps, ...(singleSetReps ? { singleSetReps } : {}) };
}

function restoreStarter() {
  try {
    const values = JSON.parse(localStorage.getItem(starterKey) ?? '[]');
    starterValues = new Map(values.map(parseStarter).map(value => [value.id, value]));
  } catch {
    starterValues = new Map();
  }
}

function parseBackupEntry(value) {
  const { id, exerciseId, name, date, weight, sets, reps, updatedAt } = value ?? {};
  const item = exerciseById.get(exerciseId);
  const day = new Date(date);
  if (typeof id !== 'string' || !/^[a-z0-9-]{1,80}$/i.test(id) || !item || !validName(name) ||
      typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(day.valueOf()) ||
      day.toISOString().slice(0, 10) !== date || date < '1900-01-01' ||
      !optionalWeight(weight) || (weight === null && !item.bodyweight) ||
      !positiveInteger(sets, 999) || !positiveInteger(reps, 9999) || !positiveInteger(updatedAt, Number.MAX_SAFE_INTEGER))
    throw new Error('Invalid entry');
  return { id, exerciseId, name, date, weight, sets, reps, updatedAt };
}

const backupMessage = byId('backup-message');
const importFile = byId('import-file');
byId('export').addEventListener('click', () => {
  const values = exercises.map(item => starterFor(item)).map(({ id, name, weight, sets, reps, singleSetReps }) =>
    ({ id, name, weight, sets, reps, ...(singleSetReps ? { singleSetReps } : {}) }));
  const file = new Blob([JSON.stringify({ version: 1, starterValues: values, entries }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'podhod-dannye.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  backupMessage.textContent = 'Файл содержит стартовые показатели и журнал.';
});
byId('import').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  importFile.value = '';
  if (!file) return;
  if (!storageReady) {
    backupMessage.textContent = 'Хранилище на этом устройстве недоступно.';
    return;
  }
  let imported, starters;
  try {
    if (file.size > 4 * 1024 * 1024) throw new Error('Backup is too large');
    const data = JSON.parse(await file.text());
    if (data?.version !== 1 || !Array.isArray(data.starterValues) || !Array.isArray(data.entries))
      throw new Error('Invalid backup');
    starters = data.starterValues.map(parseStarter);
    imported = data.entries.map(parseBackupEntry);
  } catch {
    backupMessage.textContent = 'Выбери файл данных, созданный в «Подходе».';
    return;
  }
  const merged = new Map(entries.map(entry => [entry.id, entry]));
  for (const entry of imported) {
    if (!merged.has(entry.id) || entry.updatedAt > merged.get(entry.id).updatedAt) merged.set(entry.id, entry);
  }
  const mergedStarters = new Map(starterValues);
  for (const starter of starters) mergedStarters.set(starter.id, starter);
  try {
    localStorage.setItem(starterKey, JSON.stringify([...mergedStarters.values()]));
    starterValues = mergedStarters;
  } catch {
    backupMessage.textContent = 'Не удалось сохранить данные на устройстве.';
    return;
  }
  if (!persistEntries([...merged.values()])) {
    backupMessage.textContent = 'Стартовые показатели загружены. Журнал сохранить не удалось.';
    return;
  }
  fillExercises(group, exercise, exercise.value);
  fillExercises(progressGroup, progressExercise, progressExercise.value);
  if (!editing) {
    fillForm();
    save.disabled = !storageReady;
  }
  renderJournal();
  backupMessage.textContent = 'Данные загружены.';
});

const groupOptions = groups.map(value => [value, value]);
replaceOptions(group, groupOptions);
replaceOptions(progressGroup, groupOptions);
restoreEntries();
restoreStarter();
fillExercises(group, exercise);
fillExercises(progressGroup, progressExercise);
useEntry(null);
save.disabled = !storageReady;
if (!storageReady) showError('Не удалось прочитать журнал на этом устройстве.');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(() => {
    const state = byId('storage-state');
    state.textContent = 'Доступно офлайн';
    state.dataset.state = 'synced';
  }).catch(() => {});
}
