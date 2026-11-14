const seed = [["chest-press","Грудь","Жим",null,null,null,false],["chest-dumbbell","Грудь","Гантели",null,null,null,false],["chest-fly","Грудь","Бабочка",null,null,null,false],["biceps-machine","Бицепс","Тренажёр",null,null,null,false],["biceps-bar","Бицепс","Гриф",null,null,null,false],["biceps-dumbbell","Бицепс","Гантели сидя",null,null,null,false],["biceps-hammer","Бицепс","Молотки",null,null,null,false],["back-pullups","Спина","Подтягивания",null,null,null,true],["back-unnamed","Спина",null,null,null,null,false],["back-row","Спина","Тяга блока к себе",null,null,null,false],["back-machine-pull","Спина","Тяга в тренажёре (вверх)",null,null,null,false],["shoulder-raises","Плечи","Махи",null,null,null,false],["shoulder-cable-raises","Плечи","Махи в блоке",null,null,null,false],["shoulder-up","Плечи","Вверх",null,null,null,false],["triceps-rope","Трицепс","Верёвка в блоке",null,null,null,false],["triceps-behind","Трицепс","Блок со спины",null,null,null,false],["triceps-metal","Трицепс","Железная",null,null,null,false],["legs-up","Ноги","Тяга вверх",null,null,null,false],["legs-machine-extension","Ноги","Тренажёр разгибание",null,null,null,false],["legs-squat","Ноги","Присед",null,null,null,false],["legs-extension","Ноги","Разгибание",null,null,null,false],["traps-dumbbell","Трапеция","Гантели",null,null,null,false],["abs-machine","Пресс","Тренажёр",null,null,null,false]];
const byId = id => document.getElementById(id);
const legacyEntriesKey = 'podhod.workout-entries.v1';
const legacyStarterKey = 'podhod.starter-values.v1';
const storageKey = 'podhod.diary.v2';
const baseExercises = seed.map(([id, groupId, name, weight, sets, reps, bodyweight = false, singleSetReps]) =>
  ({ id, groupId, name, weight, sets, reps, bodyweight, singleSetReps }));
const baseById = new Map(baseExercises.map(item => [item.id, item]));
const baseGroups = [...new Set(baseExercises.map(item => item.groupId))].map(id => ({ id, name: id }));
const baseGroupIds = new Set(baseGroups.map(item => item.id));
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
const miniChart = byId('record-mini-chart');
const pointSelect = byId('chart-point');
const formatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 });
const dateFormatter = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' });
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
const bodyDate = byId('body-date');
const bodyWeight = byId('body-weight');
const saveBody = byId('save-body');
const catalogDialog = byId('catalog-dialog');
const catalogName = byId('catalog-name');
const newId = () => globalThis.crypto.randomUUID?.() ?? 'entry-' + Date.now() + '-' + Math.random().toString(36).slice(2);
let entries = [];
let weighIns = [];
let starterValues = new Map();
let catalog = { groups: [], exercises: [] };
let groups = [];
let exerciseById = new Map();
let storageReady = false;
let editing = null;
let editingBody = null;
let activePage = 'record';
let recordMode = 'workout';
let progressMode = 'workout';
let catalogTarget = null;
let catalogAction = null;
let catalogTrigger = null;
let chartPoints = [];
let pointPositions = [];
let chartUnit = 'кг';

function catalogLists(value) {
  const groupList = new Map(baseGroups.map(item => [item.id, item]));
  for (const item of value.groups) groupList.set(item.id, item);
  const exerciseList = new Map(baseById);
  for (const item of value.exercises) {
    exerciseList.set(item.id, { weight: null, sets: null, reps: null, ...baseById.get(item.id), ...item });
  }
  return { groups: [...groupList.values()], exerciseById: exerciseList };
}

function applyState(value) {
  ({ entries, weighIns, catalog } = value);
  starterValues = new Map(value.starterValues.map(item => [item.id, item]));
  ({ groups, exerciseById } = catalogLists(catalog));
}

function restoreDiary() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      applyState(parseBackup(JSON.parse(saved)));
    } else {
      const oldEntries = JSON.parse(localStorage.getItem(legacyEntriesKey) ?? '[]');
      let oldStarters;
      try {
        oldStarters = JSON.parse(localStorage.getItem(legacyStarterKey) ?? '[]')
          .map(item => parseStarter(item, baseById));
      }
      catch { oldStarters = []; }
      applyState(parseBackup({ version: 1, entries: oldEntries, starterValues: oldStarters }));
    }
    storageReady = true;
  } catch {
    storageReady = false;
    ({ groups, exerciseById } = catalogLists(catalog));
    showError('Не удалось прочитать журнал на этом устройстве.');
  }
}

function saveDiary(changes) {
  if (!storageReady) return false;
  const value = { version: 2, entries, weighIns, catalog, starterValues: [...starterValues.values()], ...changes };
  try { localStorage.setItem(storageKey, JSON.stringify(value)); }
  catch { return false; }
  applyState(value);
  return true;
}

function persistEntries(nextEntries) {
  return saveDiary({ entries: nextEntries });
}

function today() {
  const now = new Date();
  const pad = number => String(number).padStart(2, '0');
  return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
}

function showError(message, element = formError) {
  element.textContent = message;
  element.hidden = !message;
}

function description(entry) {
  if (!entry.exerciseId && entry.sets === undefined) return formatter.format(entry.weight) + ' кг';
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

function fillSelectors(recordGroup = group.value, recordExercise = exercise.value) {
  const options = groups.map(item => [item.id, item.name]);
  replaceOptions(group, options, recordGroup);
  replaceOptions(progressGroup, options, progressGroup.value);
  fillExercises(group, exercise, recordExercise);
  fillExercises(progressGroup, progressExercise, progressExercise.value);
}

function fillExercises(groupSelect, exerciseSelect, preferred) {
  const items = [...exerciseById.values()].filter(item => item.groupId === groupSelect.value);
  replaceOptions(exerciseSelect, items.length ? items.map(item => [item.id, exerciseName(item)]) : [['', 'Нет упражнений']], preferred);
  exerciseSelect.disabled = !items.length;
}

function fillForm(preferredEntry) {
  const item = exerciseById.get(exercise.value);
  renderRecordInsights(item);
  byId('empty-group-add').hidden = !!item;
  save.disabled = !storageReady || !item;
  if (!item) {
    byId('name-row').hidden = byId('reference').hidden = true;
    nameField.value = weight.value = sets.value = reps.value = '';
    showError('');
    return;
  }
  const last = recentRecord(item.id);
  const starter = starterFor(item);
  const values = preferredEntry ?? last ?? starter;
  byId('name-row').hidden = item.name !== null;
  nameField.required = item.name === null;
  nameField.value = (item.name ?? values.name) ?? '';
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
  save.textContent = editing ? 'Сохранить изменения' : 'Записать';
  if (entry) {
    const item = exerciseById.get(entry.exerciseId);
    group.value = item.groupId;
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
    setMode('progress', recordMode);
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
  if (page === 'record') renderRecordInsights();
  window.scrollTo({ top: 0 });
}

function readRecord() {
  const item = exerciseById.get(exercise.value);
  const weightText = weight.value.trim().replace(',', '.');
  const weightValue = weightText ? Number(weightText) : null;
  const dateValue = date.value;
  if (!item) return ['Выбери упражнение.', exercise];
  if (item.name === null && !nameField.value.trim()) return ['Введи название упражнения.', nameField];
  if ((weightValue === null && !item.bodyweight) || (weightText && (!/^\d{1,4}(\.\d{1,3})?$/.test(weightText) || weightValue > 9999)))
    return ['Введи вес в килограммах, например 17,5.', weight];
  if (!/^\d{1,3}$/.test(sets.value) || Number(sets.value) < 1) return ['Введи число подходов.', sets];
  if (!/^\d{1,4}$/.test(reps.value) || Number(reps.value) < 1) return ['Введи общее число повторений.', reps];
  if (!validDate(dateValue)) return ['Выбери дату тренировки.', date];
  return {
    id: editing ?? newId(),
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
  save.disabled = !storageReady || !exercise.value;
  notice.textContent = '';
  showError('');
});
group.addEventListener('change', () => {
  fillExercises(group, exercise);
  fillForm();
  notice.textContent = '';
});
exercise.addEventListener('change', () => {
  fillForm();
  notice.textContent = '';
});
byId('cancel-edit').addEventListener('click', () => {
  useEntry(null);
  openPage('journal');
});
progressGroup.addEventListener('change', () => { fillExercises(progressGroup, progressExercise); renderProgress(); });
progressExercise.addEventListener('change', renderProgress);

function setMode(page, mode) {
  const body = mode === 'body';
  if (page === 'record') {
    recordMode = mode;
    byId('record-form').hidden = byId('notice').hidden = body;
    byId('body-form').hidden = !body;
    byId('record-title').textContent = (body ? editingBody : editing) ? 'Редактировать' : 'Запись';
    renderRecordInsights();
  } else {
    progressMode = mode;
    byId('progress-picker').hidden = body;
  }
  for (const button of byId(page + '-mode').querySelectorAll('[data-mode]'))
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
}

for (const page of ['record', 'progress']) {
  for (const button of byId(page + '-mode').querySelectorAll('[data-mode]')) {
    button.addEventListener('click', () => {
      setMode(page, button.dataset.mode);
      if (page === 'progress') renderProgress();
    });
  }
}

const newestFirst = (a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt;

function fillBody(entry = null) {
  editingBody = entry?.id ?? null;
  bodyDate.value = entry?.date ?? today();
  bodyWeight.value = entry ? formatter.format(entry.weight).replace(/[\s\u00a0\u202f]/g, '') : '';
  const latest = [...weighIns].sort(newestFirst)[0];
  const reference = byId('body-reference');
  reference.hidden = !latest;
  reference.textContent = latest ? 'Последнее взвешивание · ' + description(latest) : '';
  byId('cancel-body-edit').hidden = !entry;
  saveBody.textContent = entry ? 'Сохранить изменения' : 'Сохранить вес';
  saveBody.disabled = !storageReady;
  showError('', byId('body-error'));
}

byId('body-form').addEventListener('submit', event => {
  event.preventDefault();
  const raw = bodyWeight.value.trim().replace(',', '.');
  const value = Number(raw);
  const error = byId('body-error');
  if (!/^\d{1,4}(\.\d{1,3})?$/.test(raw) || value <= 0 || value > 9999) {
    showError('Введи вес в килограммах, например 82,5.', error);
    bodyWeight.focus();
    return;
  }
  if (!validDate(bodyDate.value)) {
    showError('Выбери дату взвешивания.', error);
    bodyDate.focus();
    return;
  }
  const entry = { id: editingBody ?? newId(), date: bodyDate.value, weight: value, updatedAt: Date.now() };
  if (!saveDiary({ weighIns: [...weighIns.filter(item => item.id !== entry.id), entry] })) {
    showError('Не удалось сохранить вес на устройстве.', error);
    return;
  }
  fillBody();
  setMode('record', 'body');
  byId('body-notice').textContent = 'Сохранено · ' + description(entry);
});
byId('body-form').addEventListener('input', () => {
  showError('', byId('body-error'));
  byId('body-notice').textContent = '';
});
byId('cancel-body-edit').addEventListener('click', () => {
  fillBody();
  setMode('record', 'body');
  openPage('journal');
});

function openCatalog(type, trigger, action = null) {
  catalogTarget = type;
  catalogTrigger = trigger;
  byId('catalog-title').textContent = type === 'group' ? 'Группы мышц' : 'Упражнения';
  byId('catalog-add').textContent = type === 'group' ? 'Добавить группу' : 'Добавить упражнение';
  byId('catalog-rename').textContent = type === 'group' ? 'Переименовать группу' : 'Переименовать упражнение';
  byId('catalog-rename').disabled = type === 'exercise' && !exercise.value;
  byId('catalog-actions').hidden = false;
  byId('catalog-fields').hidden = true;
  catalogDialog.showModal();
  if (action) setCatalogAction(action);
}

function setCatalogAction(action) {
  catalogAction = action;
  const selected = catalogTarget === 'group' ? groups.find(item => item.id === group.value) : exerciseById.get(exercise.value);
  byId('catalog-title').textContent = byId('catalog-' + action).textContent;
  byId('catalog-actions').hidden = true;
  byId('catalog-fields').hidden = false;
  byId('bodyweight-option').hidden = catalogTarget !== 'exercise' || action !== 'add';
  byId('bodyweight-exercise').checked = false;
  catalogName.value = action === 'rename' ? (selected.name ?? '') : '';
  showError('', byId('catalog-error'));
  catalogName.focus();
  catalogName.select();
}

for (const type of ['group', 'exercise']) {
  const trigger = byId('manage-' + type);
  trigger.addEventListener('click', () => openCatalog(type, trigger));
}
byId('empty-group-add').addEventListener('click', event => openCatalog('exercise', event.currentTarget, 'add'));
byId('catalog-add').addEventListener('click', () => setCatalogAction('add'));
byId('catalog-rename').addEventListener('click', () => setCatalogAction('rename'));
byId('close-catalog').addEventListener('click', () => catalogDialog.close());
catalogDialog.addEventListener('close', () => {
  if (catalogTrigger?.hidden) byId('manage-exercise').focus();
  else catalogTrigger?.focus();
});

byId('catalog-form').addEventListener('submit', event => {
  event.preventDefault();
  if (byId('catalog-fields').hidden) return;
  const name = catalogName.value.trim();
  const error = byId('catalog-error');
  if (!validName(name)) {
    showError('Введи название.', error);
    catalogName.focus();
    return;
  }
  const isGroup = catalogTarget === 'group';
  const adding = catalogAction === 'add';
  const id = adding ? newId() : (isGroup ? group.value : exercise.value);
  const options = isGroup ? groups : [...exerciseById.values()].filter(item => item.groupId === group.value);
  if (options.some(item => item.id !== id && (isGroup ? item.name : exerciseName(item)).toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))) {
    showError(isGroup ? 'Группа с таким названием уже есть.' : 'В этой группе уже есть упражнение с таким названием.', error);
    return;
  }
  const key = isGroup ? 'groups' : 'exercises';
  const item = isGroup ? { id, name } : {
    id, name, groupId: group.value,
    bodyweight: adding ? byId('bodyweight-exercise').checked : exerciseById.get(id).bodyweight
  };
  const nextCatalog = { ...catalog, [key]: [...catalog[key].filter(previous => previous.id !== id), item] };
  if (!saveDiary({ catalog: nextCatalog })) {
    showError('Не удалось сохранить список на устройстве.', error);
    return;
  }
  fillSelectors(isGroup ? id : group.value, isGroup ? exercise.value : id);
  if (adding) fillForm();
  else {
    byId('name-row').hidden = exerciseById.get(exercise.value)?.name !== null;
    nameField.required = !byId('name-row').hidden;
    renderRecordInsights();
  }
  notice.textContent = adding ? 'Добавлено · ' + name : 'Новое название · ' + name;
  catalogDialog.close();
});

function renderJournal() {
  const list = byId('journal-list');
  list.replaceChildren();
  byId('journal-empty').hidden = entries.length + weighIns.length > 0;
  const days = new Map();
  const sorted = [...entries, ...weighIns].sort(newestFirst);
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
      const item = exerciseById.get(entry.exerciseId);
      const title = item?.name ?? entry.name ?? 'Вес тела';
      name.textContent = title;
      const values = document.createElement('p');
      values.textContent = description(entry);
      details.append(name, values);
      const actions = document.createElement('div');
      actions.className = 'entry-actions';
      const change = document.createElement('button');
      change.type = 'button';
      change.textContent = 'Править';
      change.setAttribute('aria-label', 'Править запись: ' + title);
      change.addEventListener('click', () => {
        if (entry.exerciseId) {
          notice.textContent = '';
          useEntry(entry);
          setMode('record', 'workout');
        } else {
          byId('body-notice').textContent = '';
          fillBody(entry);
          setMode('record', 'body');
        }
        openPage('record');
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete';
      remove.textContent = 'Удалить';
      remove.setAttribute('aria-label', 'Удалить запись: ' + title);
      remove.addEventListener('click', () => {
        if (!window.confirm('Удалить запись «' + title + '»?')) return;
        const saved = entry.exerciseId ? persistEntries(entries.filter(previous => previous.id !== entry.id)) :
          saveDiary({ weighIns: weighIns.filter(previous => previous.id !== entry.id) });
        if (!saved) {
          window.alert('Не удалось удалить запись. Попробуй ещё раз.');
          return;
        }
        if (editing === entry.id) useEntry(null);
        if (!entry.exerciseId) {
          if (editingBody === entry.id) fillBody();
          else if (!editingBody) {
            const input = bodyWeight.value;
            const chosenDate = bodyDate.value;
            fillBody();
            bodyWeight.value = input;
            bodyDate.value = chosenDate;
          }
        }
        renderJournal();
      });
      actions.append(change, remove);
      row.append(details, actions);
      section.append(row);
    }
    list.append(heading, section);
  }
}

function progressSeries(item, body = false) {
  const records = body ? weighIns : entries.filter(entry => entry.exerciseId === item?.id);
  const hasWeight = records.some(entry => entry.weight !== null);
  const metric = !item?.bodyweight || hasWeight || body ? 'weight' : 'reps';
  const days = new Map();
  for (const entry of records) {
    const value = entry[metric];
    if (value === null) continue;
    const previous = days.get(entry.date);
    const isNewer = previous && entry.updatedAt > previous.entry.updatedAt;
    if (!previous || (body ? isNewer : value > previous.value || (value === previous.value && isNewer)))
      days.set(entry.date, { value, entry });
  }
  return {
    points: [...days.values()].sort((a, b) => a.entry.date.localeCompare(b.entry.date)),
    metric,
    unit: metric === 'weight' ? 'кг' : 'повт.'
  };
}

function recentExercises() {
  const latest = new Map();
  for (const entry of [...entries].sort(newestFirst)) {
    if (!latest.has(entry.exerciseId)) latest.set(entry.exerciseId, entry);
    if (latest.size >= 3) break;
  }
  return [...latest.values()];
}

function selectRecent(item) {
  group.value = item.groupId;
  fillExercises(group, exercise, item.id);
  notice.textContent = '';
  fillForm();
  if (window.scrollY > 180) byId('record-title').scrollIntoView({ block: 'start' });
}

function renderRecordInsights(item = exerciseById.get(exercise.value)) {
  const wrapper = byId('record-insights');
  wrapper.hidden = recordMode !== 'workout' || !!editing;
  if (wrapper.hidden) return;

  const recent = recentExercises();
  byId('recents').hidden = !recent.length;
  byId('recents-list').replaceChildren(...recent.map(entry => {
    const exerciseItem = exerciseById.get(entry.exerciseId);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recent-workout';
    const name = document.createElement('strong');
    name.textContent = exerciseItem.name ?? entry.name;
    const result = document.createElement('span');
    result.textContent = entry.weight === null ? entry.reps + ' повт.' : formatter.format(entry.weight) + ' кг';
    button.setAttribute('aria-pressed', String(item?.id === exerciseItem.id));
    button.append(name, result);
    button.addEventListener('click', () => {
      selectRecent(exerciseItem);
      exercise.focus({ preventScroll: true });
    });
    return button;
  }));

  const { points, unit } = progressSeries(item);
  const visible = points.slice(-8);
  const trend = byId('record-trend');
  trend.hidden = visible.length < 2;
  wrapper.hidden = !recent.length && trend.hidden;
  if (trend.hidden) return;
  const first = visible[0];
  const last = visible.at(-1);
  const diff = Math.round((last.value - first.value) * 1000) / 1000;
  byId('record-trend-name').textContent = exerciseName(item);
  byId('record-trend-value').textContent = formatter.format(last.value) + ' ' + unit;
  byId('record-trend-change').textContent = (diff > 0 ? '+' : '') + formatter.format(diff || 0) + ' ' + unit;
  byId('record-trend-first').textContent = shortDate.format(new Date(first.entry.date + 'T12:00:00'));
  byId('record-trend-last').textContent = shortDate.format(new Date(last.entry.date + 'T12:00:00'));
  byId('record-trend-open').setAttribute('aria-label', 'Подробный график · ' + exerciseName(item) + ' · ' +
    byId('record-trend-value').textContent + ' · изменение ' + byId('record-trend-change').textContent);
  drawMiniChart(visible);
}

function drawMiniChart(points) {
  const { width, height } = miniChart.getBoundingClientRect();
  if (!width || !height) return;
  const scale = window.devicePixelRatio || 1;
  miniChart.width = Math.round(width * scale);
  miniChart.height = Math.round(height * scale);
  const ctx = miniChart.getContext('2d');
  ctx.scale(scale, scale);
  const timestamps = points.map(({ entry }) => Date.parse(entry.date));
  const duration = timestamps.at(-1) - timestamps[0];
  const values = points.map(({ value }) => value);
  const low = Math.min(...values), high = Math.max(...values);
  const flat = high === low;
  const coordinates = values.map((value, index) => ({
    x: 5 + (width - 10) * ((timestamps[index] - timestamps[0]) / duration),
    y: flat ? height / 2 : height - 9 - (height - 22) * (value - low) / (high - low)
  }));
  const start = coordinates[0], end = coordinates.at(-1);
  const line = () => {
    ctx.moveTo(start.x, start.y);
    for (const point of coordinates.slice(1)) ctx.lineTo(point.x, point.y);
  };
  const fade = ctx.createLinearGradient(0, 0, 0, height);
  fade.addColorStop(0, '#d1fa703d');
  fade.addColorStop(1, '#d1fa7000');
  ctx.fillStyle = fade;
  ctx.beginPath();
  line();
  ctx.lineTo(end.x, height);
  ctx.lineTo(start.x, height);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d1fa70';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = ctx.lineCap = 'round';
  ctx.beginPath();
  line();
  ctx.stroke();
  ctx.fillStyle = '#d1fa70';
  ctx.beginPath();
  ctx.arc(end.x, end.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function renderProgress() {
  const body = progressMode === 'body';
  const item = exerciseById.get(progressExercise.value);
  const { points, metric, unit } = progressSeries(item, body);
  chartPoints = points;
  chartUnit = unit;
  pointPositions = [];
  const empty = byId('progress-empty');
  empty.hidden = chartPoints.length > 0;
  const initialDescription = !body && item ? description(starterFor(item)) : '';
  empty.textContent = body ? 'Запиши вес тела, чтобы увидеть изменения по датам.' :
    (item ? 'График появится после первой записи.' : 'В этой группе пока нет упражнений.') +
    (initialDescription ? ' Стартовые показатели · ' + initialDescription : '');
  byId('progress-summary').hidden = !chartPoints.length;
  if (!chartPoints.length) return;
  byId('chart-caption').textContent = body ? 'Вес тела' : metric === 'weight' ? 'Вес по датам' : 'Повторения по датам';
  const change = byId('chart-change');
  change.hidden = !body || chartPoints.length < 2;
  if (!change.hidden) {
    const diff = Math.round((chartPoints.at(-1).value - chartPoints[0].value) * 1000) / 1000;
    change.textContent = (diff > 0 ? '+' : '') + formatter.format(diff || 0) + ' кг с первого взвешивания';
  }
  byId('point-row').hidden = chartPoints.length < 2;
  replaceOptions(pointSelect, chartPoints.map(({ entry }, i) =>
    [String(i), dateFormatter.format(new Date(entry.date + 'T12:00:00'))]), String(chartPoints.length - 1));
  chart.setAttribute('aria-label', body ? 'График веса тела по датам' : byId('chart-caption').textContent + ' · ' + exerciseName(item));
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
    ctx.strokeStyle = '#343942';
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    ctx.fillStyle = '#abb4bf';
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
byId('record-trend-open').addEventListener('click', () => openPage('progress'));
window.addEventListener('resize', () => {
  if (activePage === 'progress') drawChart();
  if (activePage === 'record' && !byId('record-insights').hidden && !byId('record-trend').hidden)
    drawMiniChart(progressSeries(exerciseById.get(exercise.value)).points.slice(-8));
});
window.addEventListener('storage', event => {
  if (![storageKey, legacyEntriesKey, legacyStarterKey, null].includes(event.key)) return;
  restoreDiary();
  fillSelectors();
  if (activePage === 'record') renderRecordInsights();
  if (activePage === 'journal') renderJournal();
  if (activePage === 'progress') renderProgress();
});
for (const button of document.querySelectorAll('[data-page]')) button.addEventListener('click', () => openPage(button.dataset.page));

const optionalWeight = value => value === null || (Number.isFinite(value) && value >= 0 && value <= 9999);
const positiveInteger = (value, max) => Number.isInteger(value) && value >= 1 && value <= max;
const validName = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 70;
const validId = value => typeof value === 'string' && /^[a-z0-9-]{1,80}$/i.test(value);
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01') return false;
  const day = new Date(value);
  return Number.isFinite(day.valueOf()) && day.toISOString().slice(0, 10) === value;
}

function parseCatalog(value) {
  if (!Array.isArray(value?.groups) || !Array.isArray(value.exercises)) throw new Error('Invalid catalog');
  const groupIds = new Set(baseGroupIds);
  const newGroups = value.groups.map(({ id, name }) => {
    if ((!validId(id) && !baseGroupIds.has(id)) || !validName(name)) throw new Error('Invalid group');
    groupIds.add(id);
    return { id, name: name.trim() };
  });
  const newExercises = value.exercises.map(({ id, name, groupId, bodyweight }) => {
    const base = baseById.get(id);
    if (!validId(id) || !validName(name) || !groupIds.has(groupId) || typeof bodyweight !== 'boolean' ||
        (base && (base.groupId !== groupId || base.bodyweight !== bodyweight))) throw new Error('Invalid exercise');
    return { id, name: name.trim(), groupId, bodyweight };
  });
  return { groups: newGroups, exercises: newExercises };
}

function parseStarter(value, exerciseLookup) {
  const { id, name, weight, sets, reps, singleSetReps } = value ?? {};
  if (!exerciseLookup.has(id) || (name !== null && !validName(name)) || !optionalWeight(weight) ||
      (sets !== null && !positiveInteger(sets, 999)) || (reps !== null && !positiveInteger(reps, 9999)) ||
      (singleSetReps !== undefined && !positiveInteger(singleSetReps, 9999))) throw new Error('Invalid starter values');
  return { id, name, weight, sets, reps, ...(singleSetReps ? { singleSetReps } : {}) };
}

function parseBackupEntry(value, exerciseLookup) {
  const { id, exerciseId, name, date, weight, sets, reps, updatedAt } = value ?? {};
  const item = exerciseLookup.get(exerciseId);
  if (!validId(id) || !item || !validName(name) || !validDate(date) ||
      !optionalWeight(weight) || (weight === null && !item.bodyweight) ||
      !positiveInteger(sets, 999) || !positiveInteger(reps, 9999) || !positiveInteger(updatedAt, Number.MAX_SAFE_INTEGER))
    throw new Error('Invalid entry');
  return { id, exerciseId, name, date, weight, sets, reps, updatedAt };
}

function parseWeighIn(value) {
  const { id, date, weight, updatedAt } = value ?? {};
  if (!validId(id) || !validDate(date) || !optionalWeight(weight) || !(weight > 0) ||
      !positiveInteger(updatedAt, Number.MAX_SAFE_INTEGER)) throw new Error('Invalid weigh-in');
  return { id, date, weight, updatedAt };
}

function parseBackup(data) {
  if (![1, 2].includes(data?.version) || !Array.isArray(data.starterValues) || !Array.isArray(data.entries))
    throw new Error('Invalid backup');
  const current = data.version === 2;
  const importedCatalog = current ? parseCatalog(data.catalog) : { groups: [], exercises: [] };
  const { exerciseById: lookup } = catalogLists(importedCatalog);
  return {
    catalog: importedCatalog,
    entries: data.entries.map(value => parseBackupEntry(value, lookup)),
    weighIns: current ? data.weighIns.map(parseWeighIn) : [],
    starterValues: data.starterValues.map(value => parseStarter(value, lookup))
  };
}

function mergeById(local, imported, useNewer = false) {
  const merged = new Map(local.map(item => [item.id, item]));
  for (const item of imported) {
    if (!useNewer || !merged.has(item.id) || item.updatedAt > merged.get(item.id).updatedAt) merged.set(item.id, item);
  }
  return [...merged.values()];
}

const backupMessage = byId('backup-message');
const importFile = byId('import-file');
byId('export').addEventListener('click', () => {
  const values = baseExercises.map(item => starterFor(item)).map(({ id, name, weight, sets, reps, singleSetReps }) =>
    ({ id, name, weight, sets, reps, ...(singleSetReps ? { singleSetReps } : {}) }));
  const file = new Blob([JSON.stringify({ version: 2, catalog, starterValues: values, entries, weighIns }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'podhod-dannye.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  backupMessage.textContent = 'В файл вошли упражнения, тренировки и взвешивания.';
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
  let imported;
  try {
    if (file.size > 4 * 1024 * 1024) throw new Error('Backup is too large');
    imported = parseBackup(JSON.parse(await file.text()));
  } catch {
    backupMessage.textContent = 'Выбери файл данных, созданный в «Подходе».';
    return;
  }
  const merged = {
    catalog: {
      groups: mergeById(imported.catalog.groups, catalog.groups),
      exercises: mergeById(imported.catalog.exercises, catalog.exercises)
    },
    entries: mergeById(entries, imported.entries, true),
    weighIns: mergeById(weighIns, imported.weighIns, true),
    starterValues: mergeById([...starterValues.values()], imported.starterValues)
  };
  if (!saveDiary(merged)) {
    backupMessage.textContent = 'Не удалось сохранить данные на устройстве.';
    return;
  }
  fillSelectors();
  if (!editing) fillForm();
  if (!editingBody) fillBody();
  renderJournal();
  backupMessage.textContent = 'Данные загружены.';
});

restoreDiary();
fillSelectors();
useEntry(null);
fillBody();
if (!storageReady) showError('Не удалось прочитать журнал на этом устройстве.');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(() => {
    const state = byId('storage-state');
    state.textContent = 'Доступно офлайн';
    state.dataset.state = 'synced';
  }).catch(() => {});
}
