import { buildAutoGroups, compareVersionsDesc, parsePresetName } from './grouping.js';

const MODULE_NAME = 'promptShelf';
const SELECTOR = '#settings_preset_openai';
const DEFAULTS = {
    version: 1,
    enabled: true,
    autoGroup: true,
    similarityThreshold: 0.84,
    slotCount: 4,
    groups: [],
    assignments: {},
    quickSlots: [null, null, null, null],
    collapsedGroups: {},
};

const copy = value => JSON.parse(JSON.stringify(value));
let context;
let settings;
let root;
let observer;
let themeObserver;
let renderQueued = false;
let activeFilter = 'all';
let searchTerm = '';
let manageMode = false;

const labels = {
    ko: {
        title: '프롬프트 선반', subtitle: '버전별로 모아 보고 빠르게 전환하세요', search: '프롬프트 검색…',
        all: '전체', quick: '퀵 프롬프트', manage: '그룹 관리', done: '관리 완료', auto: '자동',
        latest: '최신', noVersion: '버전 없음', empty: '표시할 프롬프트가 없습니다.', newGroup: '새 그룹 이름',
        add: '추가', delete: '삭제', ungrouped: '자동 분류', assign: '그룹 지정', pin: '현재 프리셋 저장',
        clear: '슬롯 비우기', slot: '슬롯', current: '사용 중', settingsTitle: 'Prompt Shelf', enabled: '프리셋 선반 표시',
        autoGroup: '비슷한 이름 자동 그룹화', sensitivity: '그룹 유사도', slotCount: '퀵 슬롯 수', saved: '퀵 슬롯에 저장했습니다.',
        addGroup: '새 그룹 만들기', collapseAll: '모든 그룹 접기/펼치기', renameGroup: '그룹 이름 바꾸기',
        renamePreset: '프리셋 이름 바꾸기', replace: '현재 프리셋으로 교체', openClose: '서랍 접기/펼치기', renamed: '이름을 변경했습니다.',
    },
    en: {
        title: 'Prompt Shelf', subtitle: 'Browse versions together and switch instantly', search: 'Search prompts…',
        all: 'All', quick: 'Quick prompts', manage: 'Manage groups', done: 'Done', auto: 'Auto',
        latest: 'Latest', noVersion: 'No version', empty: 'No prompts to show.', newGroup: 'New group name',
        add: 'Add', delete: 'Delete', ungrouped: 'Auto group', assign: 'Assign group', pin: 'Pin current preset',
        clear: 'Clear slot', slot: 'Slot', current: 'Active', settingsTitle: 'Prompt Shelf', enabled: 'Show preset shelf',
        autoGroup: 'Automatically group similar names', sensitivity: 'Grouping similarity', slotCount: 'Quick slot count', saved: 'Saved to quick slot.',
        addGroup: 'Create group', collapseAll: 'Collapse or expand all groups', renameGroup: 'Rename group',
        renamePreset: 'Rename preset', replace: 'Replace with current preset', openClose: 'Collapse or expand drawer', renamed: 'Renamed.',
    },
};

function t(key) {
    const language = document.documentElement.lang?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
    return labels[language][key] ?? labels.en[key] ?? key;
}

function mergeSettings(current) {
    const merged = { ...copy(DEFAULTS), ...(current ?? {}) };
    merged.groups = Array.isArray(merged.groups) ? merged.groups : [];
    merged.assignments = merged.assignments && typeof merged.assignments === 'object' ? merged.assignments : {};
    merged.quickSlots = Array.isArray(merged.quickSlots) ? merged.quickSlots : [];
    merged.collapsedGroups = merged.collapsedGroups && typeof merged.collapsedGroups === 'object' ? merged.collapsedGroups : {};
    merged.slotCount = Math.min(8, Math.max(2, Number(merged.slotCount) || 4));
    merged.similarityThreshold = Math.min(0.98, Math.max(0.65, Number(merged.similarityThreshold) || DEFAULTS.similarityThreshold));
    while (merged.quickSlots.length < merged.slotCount) merged.quickSlots.push(null);
    return merged;
}

function save() {
    context.extensionSettings[MODULE_NAME] = settings;
    context.saveSettingsDebounced();
}

function getPresets() {
    const select = document.querySelector(SELECTOR);
    if (!select) return [];
    return Array.from(select.options)
        .filter(option => option.value !== 'gui')
        .map(option => ({ value: option.value, name: option.textContent.trim() }));
}

function getSelected() {
    const select = document.querySelector(SELECTOR);
    const option = select?.selectedOptions?.[0];
    return option ? { value: option.value, name: option.textContent.trim() } : null;
}

function selectPreset(value) {
    const select = document.querySelector(SELECTOR);
    if (!select || !Array.from(select.options).some(option => option.value === String(value))) return;
    const manager = context.getPresetManager?.('openai');
    if (manager) manager.selectPreset(String(value));
    else window.jQuery?.(select).val(String(value)).trigger('change');
    queueRender();
}

function groupPresets(presets) {
    const manualGroups = settings.groups.map(group => ({ ...group, auto: false, presets: [] }));
    const manualById = new Map(manualGroups.map(group => [group.id, group]));
    const automatic = [];
    for (const preset of presets) {
        const assigned = manualById.get(settings.assignments[preset.name]);
        if (assigned) assigned.presets.push({ ...preset, ...parsePresetName(preset.name) });
        else automatic.push(preset);
    }
    const autoGroups = settings.autoGroup
        ? buildAutoGroups(automatic, settings.similarityThreshold)
        : automatic.map(preset => ({ base: preset.name, auto: true, presets: [{ ...preset, ...parsePresetName(preset.name) }] }));
    for (const group of manualGroups) group.presets.sort(compareVersionsDesc);
    return [...manualGroups.filter(group => group.presets.length || manageMode), ...autoGroups]
        .map((group, index) => ({ ...group, key: group.id ?? `auto:${group.base}:${index}` }));
}

function escapeHtml(value) {
    const node = document.createElement('div');
    node.textContent = String(value ?? '');
    return node.innerHTML;
}

function escapeAttr(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function groupOptions(selectedId) {
    return `<option value="">${escapeHtml(t('ungrouped'))}</option>` + settings.groups.map(group =>
        `<option value="${escapeAttr(group.id)}" ${group.id === selectedId ? 'selected' : ''}>${escapeHtml(group.name)}</option>`
    ).join('');
}

function renderQuickSlots(presets, selected) {
    const byName = new Map(presets.map(preset => [preset.name, preset]));
    return Array.from({ length: settings.slotCount }, (_, index) => {
        const name = settings.quickSlots[index];
        const preset = byName.get(name);
        const isActive = preset && preset.value === selected?.value;
        return `<div class="prpt-slot ${preset ? 'has-preset' : 'is-empty'} ${isActive ? 'is-active' : ''}" data-slot="${index}">
            <button class="prpt-slot-main" title="${escapeAttr(preset?.name ?? t('pin'))}">
                <span class="prpt-slot-number">${preset ? index + 1 : '＋'}</span><span class="prpt-slot-name">${escapeHtml(preset?.name ?? `${t('slot')} ${index + 1}`)}</span>
            </button>
            <button class="prpt-slot-pin" title="${escapeAttr(preset ? t('replace') : t('pin'))}" aria-label="${escapeAttr(preset ? t('replace') : t('pin'))}">${preset ? '↻' : '📌'}</button>
            <button class="prpt-slot-clear" title="${escapeAttr(t('clear'))}" aria-label="${escapeAttr(t('clear'))}">×</button>
        </div>`;
    }).join('');
}

function renderGroup(group, selected) {
    const collapsed = Boolean(settings.collapsedGroups[group.key]);
    const visiblePresets = group.presets.filter(preset => !searchTerm || preset.name.toLocaleLowerCase().includes(searchTerm));
    if (!visiblePresets.length && !manageMode) return '';
    const versions = visiblePresets.map((preset, index) => {
        const active = preset.value === selected?.value;
        const label = preset.version ? `v${preset.version}` : (group.presets.length === 1 ? preset.name : t('noVersion'));
        return `<div class="prpt-preset-wrap ${active ? 'is-active' : ''}" data-preset-name="${escapeAttr(preset.name)}" data-preset-value="${escapeAttr(preset.value)}">
            <button class="prpt-preset" data-preset-value="${escapeAttr(preset.value)}" title="${escapeAttr(preset.name)}">
                <span>${escapeHtml(label)}</span>${index === 0 && preset.version ? `<small>${escapeHtml(t('latest'))}</small>` : ''}
            </button>
            <button class="prpt-rename-preset" title="${escapeAttr(t('renamePreset'))}" aria-label="${escapeAttr(t('renamePreset'))}">✎</button>
            <select class="prpt-assign" data-preset-name="${escapeAttr(preset.name)}" title="${escapeAttr(t('assign'))}">${groupOptions(settings.assignments[preset.name] ?? '')}</select>
        </div>`;
    }).join('');
    return `<section class="prpt-group ${collapsed ? 'is-collapsed' : ''}" data-group-key="${escapeAttr(group.key)}">
        <div class="prpt-group-head">
            <button class="prpt-drawer-toggle" type="button" title="${escapeAttr(t('openClose'))}" aria-label="${escapeAttr(t('openClose'))}"><span class="prpt-chevron">▾</span></button>
            <span class="prpt-group-name">${escapeHtml(group.name ?? group.base)}</span>
            ${group.auto ? `<span class="prpt-auto">${escapeHtml(t('auto'))}</span>` : ''}
            <span class="prpt-count">${group.presets.length}</span>
            <button class="prpt-rename-group" type="button" title="${escapeAttr(t('renameGroup'))}" aria-label="${escapeAttr(t('renameGroup'))}">✎</button>
        </div>
        <div class="prpt-versions">${versions}</div>
    </section>`;
}

function render() {
    renderQueued = false;
    if (!root || !document.contains(root)) return;
    const presets = getPresets();
    const selected = getSelected();
    const groups = groupPresets(presets);
    const filteredGroups = activeFilter === 'all' ? groups : groups.filter(group => group.key === activeFilter);
    root.classList.toggle('is-managing', manageMode);
    root.innerHTML = `<div class="prpt-hero">
        <div><div class="prpt-eyebrow"><i class="fa-solid fa-layer-group"></i> ${escapeHtml(t('title'))}</div><div class="prpt-subtitle">${escapeHtml(t('subtitle'))}</div></div>
        <div class="prpt-actions">
            <button class="prpt-action prpt-add-group-icon" title="${escapeAttr(t('addGroup'))}" aria-label="${escapeAttr(t('addGroup'))}">⊕</button>
            <button class="prpt-action prpt-collapse-all" title="${escapeAttr(t('collapseAll'))}" aria-label="${escapeAttr(t('collapseAll'))}">⇅</button>
            <button class="prpt-action prpt-manage ${manageMode ? 'is-active' : ''}" title="${escapeAttr(manageMode ? t('done') : t('manage'))}" aria-label="${escapeAttr(manageMode ? t('done') : t('manage'))}">${manageMode ? '✓' : '⚙'}</button>
        </div>
    </div>
    <div class="prpt-quick-label"><i class="fa-solid fa-bolt"></i> ${escapeHtml(t('quick'))}</div>
    <div class="prpt-slots">${renderQuickSlots(presets, selected)}</div>
    <div class="prpt-tools"><label class="prpt-search"><i class="fa-solid fa-magnifying-glass"></i><input value="${escapeAttr(searchTerm)}" placeholder="${escapeAttr(t('search'))}"></label></div>
    <div class="prpt-filters"><button class="${activeFilter === 'all' ? 'is-active' : ''}" data-filter="all">${escapeHtml(t('all'))} <span>${presets.length}</span></button>${groups.map(group => `<button class="${activeFilter === group.key ? 'is-active' : ''}" data-filter="${escapeAttr(group.key)}">${escapeHtml(group.name ?? group.base)}</button>`).join('')}</div>
    <div class="prpt-group-editor"><input class="text_pole" placeholder="${escapeAttr(t('newGroup'))}"><button class="prpt-add-group" title="${escapeAttr(t('addGroup'))}" aria-label="${escapeAttr(t('addGroup'))}">＋</button><div class="prpt-custom-groups">${settings.groups.map(group => `<div data-id="${escapeAttr(group.id)}"><input class="text_pole" value="${escapeAttr(group.name)}"><button title="${escapeAttr(t('delete'))}">×</button></div>`).join('')}</div></div>
    <div class="prpt-groups">${filteredGroups.map(group => renderGroup(group, selected)).join('') || `<div class="prpt-empty">${escapeHtml(t('empty'))}</div>`}</div>`;
    bindRootEvents();
}

function bindRootEvents() {
    root.querySelector('.prpt-manage')?.addEventListener('click', () => { manageMode = !manageMode; render(); });
    root.querySelector('.prpt-add-group-icon')?.addEventListener('click', promptAddGroup);
    root.querySelector('.prpt-collapse-all')?.addEventListener('click', toggleAllGroups);
    root.querySelector('.prpt-search input')?.addEventListener('input', event => {
        searchTerm = event.target.value.toLocaleLowerCase().trim();
        const position = event.target.selectionStart;
        render();
        const input = root.querySelector('.prpt-search input');
        input?.focus(); input?.setSelectionRange(position, position);
    });
    root.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { activeFilter = button.dataset.filter; render(); }));
    root.querySelectorAll('.prpt-drawer-toggle').forEach(button => button.addEventListener('click', () => {
        const key = button.closest('.prpt-group').dataset.groupKey;
        settings.collapsedGroups[key] = !settings.collapsedGroups[key]; save(); render();
    }));
    root.querySelectorAll('.prpt-rename-group').forEach(button => button.addEventListener('click', () => renameGroup(button.closest('.prpt-group').dataset.groupKey)));
    root.querySelectorAll('.prpt-preset[data-preset-value]').forEach(button => button.addEventListener('click', () => selectPreset(button.dataset.presetValue)));
    root.querySelectorAll('.prpt-rename-preset').forEach(button => button.addEventListener('click', () => renamePreset(button.closest('.prpt-preset-wrap'))));
    root.querySelectorAll('.prpt-assign').forEach(select => select.addEventListener('change', () => {
        if (select.value) settings.assignments[select.dataset.presetName] = select.value;
        else delete settings.assignments[select.dataset.presetName];
        save(); render();
    }));
    root.querySelectorAll('.prpt-slot').forEach(slot => {
        const index = Number(slot.dataset.slot);
        slot.querySelector('.prpt-slot-main').addEventListener('click', () => {
            const preset = getPresets().find(item => item.name === settings.quickSlots[index]);
            if (preset) selectPreset(preset.value); else pinSlot(index);
        });
        slot.querySelector('.prpt-slot-pin').addEventListener('click', () => pinSlot(index));
        slot.querySelector('.prpt-slot-clear').addEventListener('click', () => { settings.quickSlots[index] = null; save(); render(); });
    });
    root.querySelector('.prpt-add-group')?.addEventListener('click', addGroup);
    root.querySelector('.prpt-group-editor > input')?.addEventListener('keydown', event => { if (event.key === 'Enter') addGroup(); });
    root.querySelectorAll('.prpt-custom-groups > div').forEach(row => {
        row.querySelector('input').addEventListener('change', event => {
            const group = settings.groups.find(item => item.id === row.dataset.id);
            if (group && event.target.value.trim()) group.name = event.target.value.trim();
            save(); render();
        });
        row.querySelector('button').addEventListener('click', () => deleteGroup(row.dataset.id));
    });
}

function toggleAllGroups() {
    const groups = groupPresets(getPresets());
    const shouldCollapse = groups.some(group => !settings.collapsedGroups[group.key]);
    for (const group of groups) settings.collapsedGroups[group.key] = shouldCollapse;
    save(); render();
}

function promptAddGroup() {
    const name = window.prompt(t('newGroup'))?.trim();
    if (name) createGroup(name);
}

function createGroup(name) {
    settings.groups.push({ id: `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name });
    save(); render();
}

function renameGroup(key) {
    const groups = groupPresets(getPresets());
    const rendered = groups.find(group => group.key === key);
    if (!rendered) return;
    const name = window.prompt(t('renameGroup'), rendered.name ?? rendered.base)?.trim();
    if (!name || name === (rendered.name ?? rendered.base)) return;
    let group = settings.groups.find(item => item.id === key);
    if (!group) {
        group = { id: `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name };
        settings.groups.push(group);
        for (const preset of rendered.presets) settings.assignments[preset.name] = group.id;
        if (activeFilter === key) activeFilter = group.id;
    } else {
        group.name = name;
    }
    save(); render();
}

async function renamePreset(row) {
    const oldName = row?.dataset.presetName;
    const value = row?.dataset.presetValue;
    const newName = window.prompt(t('renamePreset'), oldName)?.trim();
    if (!oldName || !newName || newName === oldName) return;
    if (getPresets().some(preset => preset.name.toLocaleLowerCase() === newName.toLocaleLowerCase())) {
        window.toastr?.warning(newName, t('renamePreset'));
        return;
    }
    const manager = context.getPresetManager?.('openai');
    if (!manager?.renamePreset) return;
    if (getSelected()?.value !== value) {
        const changed = new Promise(resolve => {
            const timer = setTimeout(resolve, 1600);
            const eventName = context.event_types?.OAI_PRESET_CHANGED_AFTER;
            if (eventName && context.eventSource?.once) context.eventSource.once(eventName, () => { clearTimeout(timer); resolve(); });
        });
        selectPreset(value);
        await changed;
    }
    try {
        await manager.renamePreset(newName);
        if (settings.assignments[oldName]) {
            settings.assignments[newName] = settings.assignments[oldName];
            delete settings.assignments[oldName];
        }
        settings.quickSlots = settings.quickSlots.map(name => name === oldName ? newName : name);
        save();
        window.toastr?.success(t('renamed'));
        queueRender();
    } catch (error) {
        console.error('[PromptShelf] Failed to rename preset', error);
    }
}

function pinSlot(index) {
    const selected = getSelected();
    if (!selected || selected.value === 'gui') return;
    settings.quickSlots[index] = selected.name;
    save(); render();
    window.toastr?.success(t('saved'));
}

function addGroup() {
    const input = root.querySelector('.prpt-group-editor > input');
    const name = input?.value.trim();
    if (!name) return;
    createGroup(name);
}

function deleteGroup(id) {
    settings.groups = settings.groups.filter(group => group.id !== id);
    for (const [name, groupId] of Object.entries(settings.assignments)) if (groupId === id) delete settings.assignments[name];
    if (activeFilter === id) activeFilter = 'all';
    save(); render();
}

function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(render);
}

function syncThemeColors() {
    if (!root) return;
    const styleSources = [getComputedStyle(document.documentElement), document.body && getComputedStyle(document.body)].filter(Boolean);
    const read = (...names) => names.flatMap(name => styleSources.map(styles => styles.getPropertyValue(name).trim())).find(Boolean);
    const colors = {
        '--prpt-theme-text': read('--SmartThemeBodyColor', '--SmartThemeEmColor'),
        '--prpt-theme-muted': read('--SmartThemeEmColor', '--SmartThemeBodyColor'),
        '--prpt-theme-accent': read('--SmartThemeQuoteColor', '--SmartThemeEmColor', '--SmartThemeBodyColor'),
        '--prpt-theme-panel': read('--SmartThemeBlurTintColor', '--SmartThemeBotMesBlurTintColor', '--SmartThemeUserMesBlurTintColor'),
        '--prpt-theme-border': read('--SmartThemeBorderColor', '--SmartThemeEmColor', '--SmartThemeBodyColor'),
    };
    for (const [property, value] of Object.entries(colors)) {
        if (value) root.style.setProperty(property, value);
        else root.style.removeProperty(property);
    }
}

function injectShelf() {
    if (document.getElementById('prpt-shelf')) return true;
    const target = document.querySelector('#openai_api-presets');
    const select = document.querySelector(SELECTOR);
    if (!target || !select) return false;
    root = document.createElement('div');
    root.id = 'prpt-shelf';
    root.hidden = !settings.enabled;
    target.prepend(root);
    syncThemeColors();
    themeObserver = new MutationObserver(syncThemeColors);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    if (document.body) themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
    select.addEventListener('change', queueRender);
    observer = new MutationObserver(queueRender);
    observer.observe(select, { childList: true, subtree: true, characterData: true });
    render();
    return true;
}

async function injectExtensionSettings() {
    const container = document.querySelector('#extensions_settings2');
    if (!container || document.getElementById('prpt-extension-settings')) return;
    const panel = document.createElement('div');
    panel.id = 'prpt-extension-settings';
    panel.className = 'extension_container';
    panel.innerHTML = `<div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b><i class="fa-solid fa-layer-group"></i> ${escapeHtml(t('settingsTitle'))}</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
        <div class="inline-drawer-content"><label class="checkbox_label"><input data-setting="enabled" type="checkbox" ${settings.enabled ? 'checked' : ''}><span>${escapeHtml(t('enabled'))}</span></label>
        <label class="checkbox_label"><input data-setting="autoGroup" type="checkbox" ${settings.autoGroup ? 'checked' : ''}><span>${escapeHtml(t('autoGroup'))}</span></label>
        <label>${escapeHtml(t('sensitivity'))} <output>${Math.round(settings.similarityThreshold * 100)}%</output><input data-setting="similarityThreshold" type="range" min="0.65" max="0.98" step="0.01" value="${settings.similarityThreshold}"></label>
        <label>${escapeHtml(t('slotCount'))}<input class="text_pole" data-setting="slotCount" type="number" min="2" max="8" value="${settings.slotCount}"></label></div></div>`;
    container.append(panel);
    panel.querySelectorAll('[data-setting]').forEach(input => input.addEventListener('input', () => {
        const key = input.dataset.setting;
        settings[key] = input.type === 'checkbox' ? input.checked : Number(input.value);
        if (key === 'slotCount') settings[key] = Math.min(8, Math.max(2, settings[key]));
        panel.querySelector('output').textContent = `${Math.round(settings.similarityThreshold * 100)}%`;
        if (root) root.hidden = !settings.enabled;
        save(); queueRender();
    }));
}

async function init() {
    context = SillyTavern.getContext();
    settings = mergeSettings(context.extensionSettings[MODULE_NAME]);
    context.extensionSettings[MODULE_NAME] = settings;
    save();
    injectExtensionSettings();
    if (!injectShelf()) {
        const timer = setInterval(() => { if (injectShelf()) clearInterval(timer); }, 500);
        setTimeout(() => clearInterval(timer), 30000);
    }
    if (context.event_types?.PRESET_CHANGED) context.eventSource.on(context.event_types.PRESET_CHANGED, queueRender);
    console.info('[PromptShelf] Extension loaded');
}

window.jQuery ? window.jQuery(init) : document.addEventListener('DOMContentLoaded', init, { once: true });
