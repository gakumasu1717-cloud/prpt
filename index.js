import { buildAutoGroups, parsePresetName, sortPresets } from './grouping.js';

const MODULE_NAME = 'promptShelf';
const SELECTOR = '#settings_preset_openai';
const DEFAULTS = {
    version: 3,
    enabled: true,
    autoGroup: true,
    similarityThreshold: 0.74,
    slotCount: 1,
    sortMode: 'version-desc',
    groups: [],
    assignments: {},
    quickSlots: [null],
    collapsedGroups: {},
    separatedPresets: [],
    shelfCollapsed: false,
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
let groupTypeFilter = 'all';
const removeModeGroups = new Set();

const labels = {
    ko: {
        title: '프롬프트 선반', subtitle: '버전별로 모아 보고 빠르게 전환하세요', search: '프롬프트 검색…',
        all: '전체', quick: '퀵 프롬프트', manage: '그룹 관리', done: '관리 완료', auto: '자동',
        latest: '최신', empty: '표시할 프롬프트가 없습니다.', newGroup: '새 그룹 이름',
        add: '추가', delete: '삭제', ungrouped: '자동 분류', assign: '그룹 지정', pin: '현재 프리셋 저장',
        clear: '슬롯 비우기', slot: '슬롯', current: '사용 중', settingsTitle: 'Prompt Shelf', enabled: '프리셋 선반 표시',
        autoGroup: '비슷한 이름 자동 그룹화', sensitivity: '그룹 유사도', saved: '퀵 슬롯에 저장했습니다.',
        addGroup: '새 그룹 만들기', collapseAll: '모든 그룹 접기/펼치기', renameGroup: '그룹 이름 바꾸기',
        renamePreset: '프리셋 이름 바꾸기', replace: '현재 프리셋으로 교체', openClose: '서랍 접기/펼치기', renamed: '이름을 변경했습니다.',
        addToGroup: '이 서랍에 프리셋 추가', removeFromGroup: '이 서랍에서만 빼기', deletePreset: '프리셋 완전 삭제',
        deleteQuestion: '정말 삭제할까요?', deleteWarning: '원본 프리셋도 삭제되며 되돌릴 수 없습니다.', cancel: '취소', confirmDelete: '삭제',
        dragHint: '프리셋을 다른 서랍으로 끌어 그룹화할 수 있습니다.', choosePreset: '추가할 프리셋 선택', removed: '그룹에서 뺐습니다.',
        shelfToggle: '프롬프트 선반 전체 접기/펼치기', userGroups: '내가 만든 그룹', autoGroups: '자동 버전 그룹',
        currentPreset: '현재 프롬프트',
        addSlot: '퀵 슬롯 추가', sort: '프롬프트 정렬', newest: '버전 최신순', oldest: '버전 오래된순', nameAsc: '이름 오름차순', nameDesc: '이름 내림차순',
        selectMany: '여러 프리셋 선택', addSelected: '선택한 프리셋 한 번에 추가',
    },
    en: {
        title: 'Prompt Shelf', subtitle: 'Browse versions together and switch instantly', search: 'Search prompts…',
        all: 'All', quick: 'Quick prompts', manage: 'Manage groups', done: 'Done', auto: 'Auto',
        latest: 'Latest', empty: 'No prompts to show.', newGroup: 'New group name',
        add: 'Add', delete: 'Delete', ungrouped: 'Auto group', assign: 'Assign group', pin: 'Pin current preset',
        clear: 'Clear slot', slot: 'Slot', current: 'Active', settingsTitle: 'Prompt Shelf', enabled: 'Show preset shelf',
        autoGroup: 'Automatically group similar names', sensitivity: 'Grouping similarity', saved: 'Saved to quick slot.',
        addGroup: 'Create group', collapseAll: 'Collapse or expand all groups', renameGroup: 'Rename group',
        renamePreset: 'Rename preset', replace: 'Replace with current preset', openClose: 'Collapse or expand drawer', renamed: 'Renamed.',
        addToGroup: 'Add a preset to this drawer', removeFromGroup: 'Remove from this drawer only', deletePreset: 'Permanently delete preset',
        deleteQuestion: 'Delete this preset?', deleteWarning: 'This deletes the original preset and cannot be undone.', cancel: 'Cancel', confirmDelete: 'Delete',
        dragHint: 'Drag presets onto another drawer to group them.', choosePreset: 'Choose a preset to add', removed: 'Removed from group.',
        shelfToggle: 'Collapse or expand Prompt Shelf', userGroups: 'My groups', autoGroups: 'Automatic version groups',
        currentPreset: 'Current prompt',
        addSlot: 'Add quick slot', sort: 'Sort prompts', newest: 'Newest version', oldest: 'Oldest version', nameAsc: 'Name A–Z', nameDesc: 'Name Z–A',
        selectMany: 'Select multiple presets', addSelected: 'Add selected presets together',
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
    merged.separatedPresets = Array.isArray(merged.separatedPresets) ? merged.separatedPresets : [];
    if ((current?.version ?? 1) < 2 && Number(merged.similarityThreshold) === 0.84) merged.similarityThreshold = DEFAULTS.similarityThreshold;
    if ((current?.version ?? 1) < 3) {
        const lastUsedSlot = merged.quickSlots.reduce((last, name, index) => name ? index : last, -1);
        merged.slotCount = Math.max(1, lastUsedSlot + 1);
    }
    merged.version = DEFAULTS.version;
    merged.slotCount = Math.min(12, Math.max(1, Number(merged.slotCount) || 1));
    merged.sortMode = ['version-desc', 'version-asc', 'name-asc', 'name-desc'].includes(merged.sortMode) ? merged.sortMode : DEFAULTS.sortMode;
    merged.similarityThreshold = Math.min(0.98, Math.max(0.65, Number(merged.similarityThreshold) || DEFAULTS.similarityThreshold));
    while (merged.quickSlots.length < merged.slotCount) merged.quickSlots.push(null);
    merged.quickSlots = merged.quickSlots.slice(0, merged.slotCount);
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
    const separated = new Set(settings.separatedPresets);
    for (const preset of presets) {
        const assigned = manualById.get(settings.assignments[preset.name]);
        if (assigned) assigned.presets.push({ ...preset, ...parsePresetName(preset.name) });
        else if (!separated.has(preset.name)) automatic.push(preset);
    }
    const autoGroups = settings.autoGroup
        ? buildAutoGroups(automatic, settings.similarityThreshold)
        : automatic.map(preset => ({ base: preset.name, auto: true, presets: [{ ...preset, ...parsePresetName(preset.name) }] }));
    const separatedGroups = presets.filter(preset => separated.has(preset.name) && !settings.assignments[preset.name])
        .map(preset => ({ base: preset.name, auto: true, separated: true, presets: [{ ...preset, ...parsePresetName(preset.name) }] }));
    return [...manualGroups.filter(group => group.presets.length || manageMode), ...autoGroups, ...separatedGroups]
        .map((group, index) => ({ ...group, key: group.id ?? `auto:${group.base}:${index}`, presets: sortPresets(group.presets, settings.sortMode) }))
        .sort((left, right) => (left.name ?? left.base).localeCompare(right.name ?? right.base, undefined, { numeric: true, sensitivity: 'base' }));
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
    const collapsed = searchTerm ? false : settings.collapsedGroups[group.key] !== false;
    const removeMode = removeModeGroups.has(group.key);
    const visiblePresets = group.presets.filter(preset => !searchTerm || preset.name.toLocaleLowerCase().includes(searchTerm));
    if (!visiblePresets.length && !manageMode) return '';
    const versions = visiblePresets.map((preset, index) => {
        const active = preset.value === selected?.value;
        return `<div class="prpt-preset-wrap ${active ? 'is-active' : ''}" draggable="true" data-preset-name="${escapeAttr(preset.name)}" data-preset-value="${escapeAttr(preset.value)}">
            <button class="prpt-preset" data-preset-value="${escapeAttr(preset.value)}" title="${escapeAttr(preset.name)}">
                <span>${escapeHtml(preset.name)}</span>${index === 0 && preset.version && group.presets.length > 1 ? `<small>${escapeHtml(t('latest'))}</small>` : ''}
            </button>
            ${removeMode ? `<button class="prpt-remove-member" title="${escapeAttr(t('removeFromGroup'))}" aria-label="${escapeAttr(t('removeFromGroup'))}">−</button>` : ''}
            <button class="prpt-rename-preset" title="${escapeAttr(t('renamePreset'))}" aria-label="${escapeAttr(t('renamePreset'))}">✎</button>
            <button class="prpt-delete-preset" title="${escapeAttr(t('deletePreset'))}" aria-label="${escapeAttr(t('deletePreset'))}">🗑</button>
            <select class="prpt-assign" data-preset-name="${escapeAttr(preset.name)}" title="${escapeAttr(t('assign'))}">${groupOptions(settings.assignments[preset.name] ?? '')}</select>
        </div>`;
    }).join('');
    const members = new Set(group.presets.map(preset => preset.name));
    const addable = getPresets().filter(preset => !members.has(preset.name));
    const addOptions = addable.map(preset => `<label><input type="checkbox" value="${escapeAttr(preset.name)}"><span>${escapeHtml(preset.name)}</span></label>`).join('');
    return `<section class="prpt-group ${collapsed ? 'is-collapsed' : ''} ${removeMode ? 'is-removing' : ''}" data-group-key="${escapeAttr(group.key)}">
        <div class="prpt-group-head">
            <button class="prpt-group-summary" type="button" title="${escapeAttr(t('openClose'))}" aria-label="${escapeAttr(t('openClose'))}"><span class="prpt-chevron">▾</span><span class="prpt-group-name">${escapeHtml(group.name ?? group.base)}</span><span class="prpt-count">${group.presets.length}</span></button>
            <button class="prpt-rename-group" type="button" title="${escapeAttr(t('renameGroup'))}" aria-label="${escapeAttr(t('renameGroup'))}">✎</button>
        </div>
        <div class="prpt-drawer-body"><div class="prpt-versions">${versions}</div><div class="prpt-group-members"><button class="prpt-member-picker-toggle" title="${escapeAttr(t('selectMany'))}" aria-label="${escapeAttr(t('selectMany'))}" ${addable.length ? '' : 'disabled'}>＋</button><button class="prpt-member-remove-toggle ${removeMode ? 'is-active' : ''}" title="${escapeAttr(t('removeFromGroup'))}" aria-label="${escapeAttr(t('removeFromGroup'))}">−</button></div><div class="prpt-member-picker" hidden><div>${addOptions || `<span class="prpt-picker-empty">${escapeHtml(t('empty'))}</span>`}</div><footer><button class="prpt-picker-cancel">×</button><button class="prpt-picker-confirm" title="${escapeAttr(t('addSelected'))}">✓</button></footer></div></div>
    </section>`;
}

function render() {
    renderQueued = false;
    if (!root || !document.contains(root)) return;
    const scrollHost = root.closest('.scrollableInner') ?? document.scrollingElement;
    const savedScrollTop = scrollHost?.scrollTop;
    const presets = getPresets();
    const selected = getSelected();
    const groups = groupPresets(presets);
    const typeGroups = groups.filter(group => groupTypeFilter === 'all' || (groupTypeFilter === 'manual' ? !group.auto : group.auto));
    const filteredGroups = activeFilter === 'all' ? typeGroups : typeGroups.filter(group => group.key === activeFilter);
    root.classList.toggle('is-managing', manageMode);
    root.classList.toggle('is-shelf-collapsed', Boolean(settings.shelfCollapsed));
    root.innerHTML = `<div class="prpt-hero">
        <button class="prpt-shelf-toggle" title="${escapeAttr(t('shelfToggle'))}" aria-label="${escapeAttr(t('shelfToggle'))}"><span class="prpt-shelf-chevron">▾</span><span><span class="prpt-eyebrow"><i class="fa-solid fa-layer-group"></i> ${escapeHtml(t('title'))}</span><span class="prpt-subtitle">${escapeHtml(t('subtitle'))}</span></span></button>
        <div class="prpt-actions">
            <button class="prpt-action prpt-add-group-icon" title="${escapeAttr(t('addGroup'))}" aria-label="${escapeAttr(t('addGroup'))}">＋</button>
            <button class="prpt-action prpt-collapse-all" title="${escapeAttr(t('collapseAll'))}" aria-label="${escapeAttr(t('collapseAll'))}">⇅</button>
            <button class="prpt-action prpt-manage ${manageMode ? 'is-active' : ''}" title="${escapeAttr(manageMode ? t('done') : t('manage'))}" aria-label="${escapeAttr(manageMode ? t('done') : t('manage'))}">${manageMode ? '✓' : '☷'}</button>
        </div>
    </div>
    <div class="prpt-shelf-body"><div class="prpt-current"><span>● ${escapeHtml(t('currentPreset'))}</span><strong title="${escapeAttr(selected?.name ?? '—')}">${escapeHtml(selected?.name ?? '—')}</strong></div><div class="prpt-quick-label"><i class="fa-solid fa-bolt"></i> ${escapeHtml(t('quick'))}</div>
    <div class="prpt-slots">${renderQuickSlots(presets, selected)}</div>
    <button class="prpt-slot-add" title="${escapeAttr(t('addSlot'))}" aria-label="${escapeAttr(t('addSlot'))}">＋</button>
    <div class="prpt-tools"><label class="prpt-search"><i class="fa-solid fa-magnifying-glass"></i><input value="${escapeAttr(searchTerm)}" placeholder="${escapeAttr(t('search'))}"></label></div>
    <div class="prpt-sort"><span>⇅</span><select title="${escapeAttr(t('sort'))}" aria-label="${escapeAttr(t('sort'))}"><option value="version-desc" ${settings.sortMode === 'version-desc' ? 'selected' : ''}>${escapeHtml(t('newest'))}</option><option value="version-asc" ${settings.sortMode === 'version-asc' ? 'selected' : ''}>${escapeHtml(t('oldest'))}</option><option value="name-asc" ${settings.sortMode === 'name-asc' ? 'selected' : ''}>${escapeHtml(t('nameAsc'))}</option><option value="name-desc" ${settings.sortMode === 'name-desc' ? 'selected' : ''}>${escapeHtml(t('nameDesc'))}</option></select></div>
    <div class="prpt-type-filters"><button class="${groupTypeFilter === 'all' ? 'is-active' : ''}" data-type-filter="all">◈ ${escapeHtml(t('all'))}</button><button class="${groupTypeFilter === 'manual' ? 'is-active' : ''}" data-type-filter="manual">◆ ${escapeHtml(t('userGroups'))}</button><button class="${groupTypeFilter === 'auto' ? 'is-active' : ''}" data-type-filter="auto">✦ ${escapeHtml(t('autoGroups'))}</button></div>
    <div class="prpt-filters"><button class="${activeFilter === 'all' ? 'is-active' : ''}" data-filter="all">${escapeHtml(t('all'))} <span>${typeGroups.reduce((sum, group) => sum + group.presets.length, 0)}</span></button>${typeGroups.map(group => `<button class="${activeFilter === group.key ? 'is-active' : ''}" data-filter="${escapeAttr(group.key)}">${escapeHtml(group.name ?? group.base)}</button>`).join('')}</div>
    <div class="prpt-group-editor"><input class="text_pole" placeholder="${escapeAttr(t('newGroup'))}"><button class="prpt-add-group" title="${escapeAttr(t('addGroup'))}" aria-label="${escapeAttr(t('addGroup'))}">＋</button><div class="prpt-custom-groups">${settings.groups.map(group => `<div data-id="${escapeAttr(group.id)}"><input class="text_pole" value="${escapeAttr(group.name)}"><button title="${escapeAttr(t('delete'))}">×</button></div>`).join('')}</div></div>
    <div class="prpt-drag-hint">↕ ${escapeHtml(t('dragHint'))}</div><div class="prpt-groups">${filteredGroups.map(group => renderGroup(group, selected)).join('') || `<div class="prpt-empty">${escapeHtml(t('empty'))}</div>`}</div></div>`;
    bindRootEvents();
    if (scrollHost && Number.isFinite(savedScrollTop)) scrollHost.scrollTop = savedScrollTop;
}

function bindRootEvents() {
    root.querySelector('.prpt-shelf-toggle')?.addEventListener('click', () => { settings.shelfCollapsed = !settings.shelfCollapsed; save(); render(); });
    root.querySelector('.prpt-manage')?.addEventListener('click', () => { manageMode = !manageMode; render(); });
    root.querySelector('.prpt-add-group-icon')?.addEventListener('click', promptAddGroup);
    root.querySelector('.prpt-collapse-all')?.addEventListener('click', toggleAllGroups);
    root.querySelector('.prpt-slot-add')?.addEventListener('click', () => {
        if (settings.slotCount >= 12) return;
        settings.slotCount += 1;
        settings.quickSlots.push(null);
        save(); render();
    });
    root.querySelector('.prpt-sort select')?.addEventListener('change', event => { settings.sortMode = event.target.value; save(); render(); });
    root.querySelector('.prpt-search input')?.addEventListener('input', event => {
        searchTerm = event.target.value.toLocaleLowerCase().trim();
        const position = event.target.selectionStart;
        render();
        const input = root.querySelector('.prpt-search input');
        input?.focus(); input?.setSelectionRange(position, position);
    });
    root.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { activeFilter = button.dataset.filter; render(); }));
    root.querySelectorAll('[data-type-filter]').forEach(button => button.addEventListener('click', () => { groupTypeFilter = button.dataset.typeFilter; activeFilter = 'all'; render(); }));
    root.querySelectorAll('.prpt-group-summary').forEach(button => button.addEventListener('click', () => {
        const section = button.closest('.prpt-group');
        settings.collapsedGroups[section.dataset.groupKey] = section.classList.contains('is-collapsed') ? false : true; save(); render();
    }));
    root.querySelectorAll('.prpt-rename-group').forEach(button => button.addEventListener('click', () => renameGroup(button.closest('.prpt-group').dataset.groupKey)));
    root.querySelectorAll('.prpt-preset[data-preset-value]').forEach(button => button.addEventListener('click', () => selectPreset(button.dataset.presetValue)));
    root.querySelectorAll('.prpt-rename-preset').forEach(button => button.addEventListener('click', () => renamePreset(button.closest('.prpt-preset-wrap'))));
    root.querySelectorAll('.prpt-delete-preset').forEach(button => button.addEventListener('click', () => confirmDeletePreset(button.closest('.prpt-preset-wrap'))));
    root.querySelectorAll('.prpt-remove-member').forEach(button => button.addEventListener('click', () => removeFromGroup(button.closest('.prpt-preset-wrap').dataset.presetName, button.closest('.prpt-group').dataset.groupKey)));
    root.querySelectorAll('.prpt-member-remove-toggle').forEach(button => button.addEventListener('click', () => {
        const key = button.closest('.prpt-group').dataset.groupKey;
        removeModeGroups.has(key) ? removeModeGroups.delete(key) : removeModeGroups.add(key);
        render();
    }));
    root.querySelectorAll('.prpt-member-picker-toggle').forEach(button => button.addEventListener('click', () => {
        const picker = button.closest('.prpt-drawer-body').querySelector('.prpt-member-picker');
        picker.hidden = !picker.hidden;
    }));
    root.querySelectorAll('.prpt-picker-cancel').forEach(button => button.addEventListener('click', () => { button.closest('.prpt-member-picker').hidden = true; }));
    root.querySelectorAll('.prpt-picker-confirm').forEach(button => button.addEventListener('click', () => {
        const section = button.closest('.prpt-group');
        const names = Array.from(section.querySelectorAll('.prpt-member-picker input:checked'), input => input.value);
        if (names.length) addManyToGroup(names, section.dataset.groupKey);
    }));
    root.querySelectorAll('.prpt-assign').forEach(select => select.addEventListener('change', () => {
        if (select.value) {
            settings.assignments[select.dataset.presetName] = select.value;
            settings.separatedPresets = settings.separatedPresets.filter(name => name !== select.dataset.presetName);
        }
        else delete settings.assignments[select.dataset.presetName];
        save(); render();
    }));
    bindDragAndDrop();
    root.querySelectorAll('.prpt-slot').forEach(slot => {
        const index = Number(slot.dataset.slot);
        slot.querySelector('.prpt-slot-main').addEventListener('click', () => {
            const preset = getPresets().find(item => item.name === settings.quickSlots[index]);
            if (preset) selectPreset(preset.value); else pinSlot(index);
        });
        slot.querySelector('.prpt-slot-pin').addEventListener('click', () => pinSlot(index));
        slot.querySelector('.prpt-slot-clear').addEventListener('click', () => {
            settings.quickSlots[index] = null;
            while (settings.slotCount > 1 && !settings.quickSlots[settings.slotCount - 1]) {
                settings.slotCount -= 1;
                settings.quickSlots.pop();
            }
            save(); render();
        });
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
    const shouldCollapse = groups.some(group => settings.collapsedGroups[group.key] === false);
    for (const group of groups) settings.collapsedGroups[group.key] = shouldCollapse;
    save(); render();
}

function ensureManualGroup(key) {
    const existing = settings.groups.find(group => group.id === key);
    if (existing) return existing.id;
    const rendered = groupPresets(getPresets()).find(group => group.key === key);
    if (!rendered) return null;
    const group = { id: `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name: rendered.name ?? rendered.base };
    settings.groups.push(group);
    for (const preset of rendered.presets) settings.assignments[preset.name] = group.id;
    settings.separatedPresets = settings.separatedPresets.filter(name => !rendered.presets.some(preset => preset.name === name));
    if (activeFilter === key) activeFilter = group.id;
    if (groupTypeFilter === 'auto') groupTypeFilter = 'manual';
    return group.id;
}

function addToGroup(name, key) {
    addManyToGroup([name], key);
}

function addManyToGroup(names, key) {
    const groupId = ensureManualGroup(key);
    if (!groupId) return;
    for (const name of names) settings.assignments[name] = groupId;
    const added = new Set(names);
    settings.separatedPresets = settings.separatedPresets.filter(item => !added.has(item));
    settings.collapsedGroups[groupId] = false;
    save(); render();
}

function removeFromGroup(name, key) {
    if (settings.groups.some(group => group.id === key)) {
        delete settings.assignments[name];
    } else if (!settings.separatedPresets.includes(name)) {
        settings.separatedPresets.push(name);
    }
    save(); render();
    window.toastr?.info(t('removed'));
}

function bindDragAndDrop() {
    root.querySelectorAll('.prpt-preset-wrap').forEach(row => {
        row.addEventListener('dragstart', event => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/x-prompt-shelf-name', row.dataset.presetName);
            row.classList.add('is-dragging');
        });
        row.addEventListener('dragend', () => {
            root.querySelectorAll('.is-dragging, .is-drop-target').forEach(element => element.classList.remove('is-dragging', 'is-drop-target'));
        });
    });
    root.querySelectorAll('.prpt-group').forEach(section => {
        section.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; section.classList.add('is-drop-target'); });
        section.addEventListener('dragleave', event => { if (!section.contains(event.relatedTarget)) section.classList.remove('is-drop-target'); });
        section.addEventListener('drop', event => {
            event.preventDefault();
            section.classList.remove('is-drop-target');
            const name = event.dataTransfer.getData('text/x-prompt-shelf-name');
            if (name) addToGroup(name, section.dataset.groupKey);
        });
    });
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
        settings.separatedPresets = settings.separatedPresets.map(name => name === oldName ? newName : name);
        save();
        window.toastr?.success(t('renamed'));
        queueRender();
    } catch (error) {
        console.error('[PromptShelf] Failed to rename preset', error);
    }
}

function confirmDeletePreset(row) {
    const name = row?.dataset.presetName;
    if (!name) return;
    const execute = () => deletePreset(name);
    if (!window.toastr) {
        if (window.confirm(`${t('deleteQuestion')}\n${name}\n${t('deleteWarning')}`)) execute();
        return;
    }
    const toast = window.toastr.warning(
        `<div class="prpt-delete-toast"><strong>${escapeHtml(name)}</strong><p>${escapeHtml(t('deleteWarning'))}</p><div><button data-action="cancel">${escapeHtml(t('cancel'))}</button><button data-action="delete">🗑 ${escapeHtml(t('confirmDelete'))}</button></div></div>`,
        t('deleteQuestion'),
        { timeOut: 0, extendedTimeOut: 0, closeButton: true, tapToDismiss: false, escapeHtml: false },
    );
    toast?.on?.('click', '[data-action="cancel"]', event => { event.stopPropagation(); window.toastr.clear(toast); });
    toast?.on?.('click', '[data-action="delete"]', event => { event.stopPropagation(); window.toastr.clear(toast); execute(); });
}

async function deletePreset(name) {
    const manager = context.getPresetManager?.('openai');
    if (!manager?.deletePreset) return;
    try {
        const deleted = await manager.deletePreset(name);
        if (!deleted) throw new Error('Preset delete request failed');
        delete settings.assignments[name];
        settings.quickSlots = settings.quickSlots.map(item => item === name ? null : item);
        settings.separatedPresets = settings.separatedPresets.filter(item => item !== name);
        save(); queueRender();
    } catch (error) {
        console.error('[PromptShelf] Failed to delete preset', error);
        window.toastr?.error(String(error), t('deletePreset'));
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
        <label>${escapeHtml(t('sensitivity'))} <output>${Math.round(settings.similarityThreshold * 100)}%</output><input data-setting="similarityThreshold" type="range" min="0.65" max="0.98" step="0.01" value="${settings.similarityThreshold}"></label></div></div>`;
    container.append(panel);
    panel.querySelectorAll('[data-setting]').forEach(input => input.addEventListener('input', () => {
        const key = input.dataset.setting;
        settings[key] = input.type === 'checkbox' ? input.checked : Number(input.value);
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
