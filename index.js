import { applyPresetPlacement, buildAutoGroups, normalizeBase, parsePresetName, removePresetPlacement, sortGroups, sortPresets } from './grouping.js';

const MODULE_NAME = 'promptShelf';
const SELECTOR = '#settings_preset_openai';
const MAX_SLOTS = 12;

const APPEARANCES = ['theme', 'light', 'dark'];

const DEFAULTS = {
    version: 8,
    enabled: true,
    autoGroup: true,
    appearance: 'theme',
    similarityThreshold: 0.74,
    slotCount: 1,
    sortMode: 'version-desc',
    groups: [],
    assignments: {},
    quickSlots: [null],
    collapsedGroups: {},
    separatedPresets: [],
    shelfCollapsed: false,
    folders: [],
    folderAssignments: {},
    collapsedFolders: {},
    copiedAssignments: {},
};

const clone = value => JSON.parse(JSON.stringify(value));

/* ------------------------------------------------------------------ state */

let context;
let settings;
let root;
let presetObserver;
let themeObserver;
let renderQueued = false;
let activeFilter = 'all';
let searchTerm = '';
let groupTypeFilter = 'all';
let openMenu = null;
let menuOwner = null;
let placementMode = 'move';
let dropTarget = null;

/* ----------------------------------------------------------------- labels */

const labels = {
    ko: {
        title: '프롬프트 선반',
        subtitle: '버전별로 모아 보고 바로 전환하세요',
        shelfToggle: '선반 접기/펼치기',
        newGroupAction: '새 그룹 만들기',
        collapseAll: '모든 서랍 접기/펼치기',
        currentPreset: '사용 중',
        quick: '빠른 전환',
        emptySlot: '비어 있는 슬롯',
        pin: '현재 프롬프트를 이 슬롯에 저장',
        replace: '현재 프롬프트로 교체',
        clear: '슬롯 비우기',
        addSlot: '슬롯 추가',
        search: '프롬프트 이름 검색',
        clearSearch: '검색어 지우기',
        all: '전체',
        userGroups: '내 그룹',
        autoGroups: '자동',
        sort: '정렬 기준',
        newest: '최신 버전순',
        oldest: '오래된 버전순',
        nameAsc: '이름 ㄱ–ㅎ',
        nameDesc: '이름 ㅎ–ㄱ',
        dragHint: '프롬프트를 다른 서랍으로 끌어다 놓으면 옮겨집니다. Ctrl(또는 ⌥)을 누른 채 놓으면 복제됩니다.',
        empty: '표시할 프롬프트가 없습니다.',
        noSearchResult: '검색 결과가 없습니다.',
        latest: '최신',
        copyTag: '복제',
        auto: '자동 분류',
        more: '더 보기',
        rename: '이름 변경',
        renameGroup: '서랍 이름 변경',
        renameFolder: '상위 서랍 이름 변경',
        renamePreset: '프롬프트 이름 변경',
        deletePreset: '프롬프트 삭제',
        deleteGroup: '서랍 삭제',
        detachFolder: '상위 서랍 해제',
        removeFromGroup: '이 서랍에서 빼기',
        placeTo: '서랍으로 보내기',
        move: '이동',
        copy: '복제',
        newGroup: '새 그룹 이름',
        createAndPlace: '새 서랍 만들어 넣기',
        parentFolder: '상위 서랍',
        noFolder: '없음',
        addPresets: '프롬프트 추가',
        nestDrawer: '기존 서랍 넣기',
        choosePreset: '추가할 프롬프트를 고르세요',
        chooseDrawer: '이 서랍 아래에 넣을 서랍을 고르세요',
        confirm: '추가',
        cancel: '취소',
        noneAddable: '추가할 수 있는 프롬프트가 없습니다.',
        noneNestable: '넣을 수 있는 서랍이 없습니다.',
        deleteQuestion: '정말 삭제할까요?',
        deleteWarning: '원본 프롬프트가 삭제되며 되돌릴 수 없습니다.',
        confirmDelete: '삭제',
        saved: '퀵 슬롯에 저장했습니다.',
        renamed: '이름을 변경했습니다.',
        removed: '이 서랍에서 뺐습니다.',
        moved: '옮겼습니다.',
        copied: '복제했습니다.',
        duplicateName: '같은 이름의 프롬프트가 이미 있습니다.',
        settingsTitle: 'Prompt Shelf',
        enabled: '프롬프트 선반 표시',
        autoGroupSetting: '비슷한 이름 자동 묶기',
        sensitivity: '묶는 기준 유사도',
        appearance: '화면 색',
        appearanceTheme: 'SillyTavern 테마 따라가기',
        appearanceLight: '라이트 모드',
        appearanceDark: '다크 모드',
    },
    en: {
        title: 'Prompt Shelf',
        subtitle: 'Keep versions together and switch instantly',
        shelfToggle: 'Collapse or expand the shelf',
        newGroupAction: 'Create a group',
        collapseAll: 'Collapse or expand every drawer',
        currentPreset: 'Active',
        quick: 'Quick switch',
        emptySlot: 'Empty slot',
        pin: 'Save the current prompt to this slot',
        replace: 'Replace with the current prompt',
        clear: 'Clear slot',
        addSlot: 'Add slot',
        search: 'Search prompt names',
        clearSearch: 'Clear search',
        all: 'All',
        userGroups: 'My groups',
        autoGroups: 'Auto',
        sort: 'Sort by',
        newest: 'Newest version',
        oldest: 'Oldest version',
        nameAsc: 'Name A–Z',
        nameDesc: 'Name Z–A',
        dragHint: 'Drag a prompt onto another drawer to move it. Hold Ctrl (or ⌥) while dropping to copy it.',
        empty: 'No prompts to show.',
        noSearchResult: 'No matching prompts.',
        latest: 'Latest',
        copyTag: 'Copy',
        auto: 'Auto',
        more: 'More actions',
        rename: 'Rename',
        renameGroup: 'Rename drawer',
        renameFolder: 'Rename parent drawer',
        renamePreset: 'Rename prompt',
        deletePreset: 'Delete prompt',
        deleteGroup: 'Delete drawer',
        detachFolder: 'Remove parent drawer',
        removeFromGroup: 'Remove from this drawer',
        placeTo: 'Send to drawer',
        move: 'Move',
        copy: 'Copy',
        newGroup: 'New group name',
        createAndPlace: 'Create a new drawer',
        parentFolder: 'Parent drawer',
        noFolder: 'None',
        addPresets: 'Add prompts',
        nestDrawer: 'Nest an existing drawer',
        choosePreset: 'Choose prompts to add',
        chooseDrawer: 'Choose a drawer to nest here',
        confirm: 'Add',
        cancel: 'Cancel',
        noneAddable: 'No prompts left to add.',
        noneNestable: 'No drawers available to nest.',
        deleteQuestion: 'Delete this prompt?',
        deleteWarning: 'The original prompt is deleted and cannot be restored.',
        confirmDelete: 'Delete',
        saved: 'Saved to the quick slot.',
        renamed: 'Renamed.',
        removed: 'Removed from this drawer.',
        moved: 'Moved.',
        copied: 'Copied.',
        duplicateName: 'A prompt with that name already exists.',
        settingsTitle: 'Prompt Shelf',
        enabled: 'Show the prompt shelf',
        autoGroupSetting: 'Group similar names automatically',
        sensitivity: 'Grouping similarity',
        appearance: 'Appearance',
        appearanceTheme: 'Follow SillyTavern theme',
        appearanceLight: 'Light mode',
        appearanceDark: 'Dark mode',
    },
};

function t(key) {
    const language = document.documentElement.lang?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
    return labels[language][key] ?? labels.en[key] ?? key;
}

/* --------------------------------------------------------------- settings */

function mergeSettings(current) {
    const merged = { ...clone(DEFAULTS), ...(current ?? {}) };
    const isPlainObject = value => value && typeof value === 'object' && !Array.isArray(value);
    merged.groups = Array.isArray(merged.groups) ? merged.groups.filter(group => group?.id) : [];
    merged.folders = Array.isArray(merged.folders) ? merged.folders.filter(folder => folder?.id) : [];
    merged.quickSlots = Array.isArray(merged.quickSlots) ? merged.quickSlots : [];
    merged.separatedPresets = Array.isArray(merged.separatedPresets) ? merged.separatedPresets : [];
    merged.assignments = isPlainObject(merged.assignments) ? merged.assignments : {};
    merged.collapsedGroups = isPlainObject(merged.collapsedGroups) ? merged.collapsedGroups : {};
    merged.folderAssignments = isPlainObject(merged.folderAssignments) ? merged.folderAssignments : {};
    merged.collapsedFolders = isPlainObject(merged.collapsedFolders) ? merged.collapsedFolders : {};
    merged.copiedAssignments = isPlainObject(merged.copiedAssignments) ? merged.copiedAssignments : {};
    if ((current?.version ?? 1) < 2 && Number(merged.similarityThreshold) === 0.84) merged.similarityThreshold = DEFAULTS.similarityThreshold;
    if ((current?.version ?? 1) < 3) {
        const lastUsedSlot = merged.quickSlots.reduce((last, name, index) => name ? index : last, -1);
        merged.slotCount = Math.max(1, lastUsedSlot + 1);
    }
    // 2.0 pre-release stored a boolean `followTheme`; fold it into the three-state appearance.
    if (!current?.appearance && typeof current?.followTheme === 'boolean') merged.appearance = current.followTheme ? 'theme' : 'dark';
    delete merged.followTheme;
    merged.appearance = APPEARANCES.includes(merged.appearance) ? merged.appearance : DEFAULTS.appearance;
    merged.version = DEFAULTS.version;
    merged.slotCount = Math.min(MAX_SLOTS, Math.max(1, Number(merged.slotCount) || 1));
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

function saveAndRender() {
    save();
    render();
}

function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ------------------------------------------------------------ preset data */

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
        const copies = Array.isArray(settings.copiedAssignments[preset.name]) ? settings.copiedAssignments[preset.name] : [];
        for (const groupId of copies) {
            const copiedGroup = manualById.get(groupId);
            if (copiedGroup && copiedGroup !== assigned && !copiedGroup.presets.some(item => item.name === preset.name)) {
                copiedGroup.presets.push({ ...preset, ...parsePresetName(preset.name), copied: true });
            }
        }
    }
    const autoGroups = settings.autoGroup
        ? buildAutoGroups(automatic, settings.similarityThreshold)
        : automatic.map(preset => ({ base: preset.name, auto: true, presets: [{ ...preset, ...parsePresetName(preset.name) }] }));
    const separatedGroups = presets
        .filter(preset => separated.has(preset.name) && !settings.assignments[preset.name])
        .map(preset => ({ base: preset.name, auto: true, separated: true, presets: [{ ...preset, ...parsePresetName(preset.name) }] }));
    const keyedGroups = [...manualGroups, ...autoGroups, ...separatedGroups].map(group => ({
        ...group,
        key: group.id ?? `auto:${normalizeBase(group.base) || encodeURIComponent(group.base)}`,
        presets: sortPresets(group.presets, settings.sortMode),
    }));
    return sortGroups(keyedGroups, settings.sortMode);
}

const groupLabel = group => group.name ?? group.base ?? '';

/* --------------------------------------------------------- html utilities */

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

const escapeAttr = escapeHtml;

function attrs(data = {}) {
    return Object.entries(data)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => ` data-${key}="${escapeAttr(value)}"`)
        .join('');
}

function iconButton({ act, icon, label, extraClass = '', data = {} }) {
    return `<button type="button" class="prpt-icon-btn ${extraClass}" data-act="${act}"${attrs(data)} title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}"><i class="fa-solid ${icon}"></i></button>`;
}

function menuItem({ act, icon, label, danger = false, checked = false, data = {} }) {
    const classes = [danger ? 'is-danger' : '', checked ? 'is-checked' : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${classes}" data-act="${act}"${attrs(data)}><i class="fa-solid ${checked ? 'fa-check' : icon}"></i><span>${escapeHtml(label)}</span></button>`;
}

/* ---------------------------------------------------------------- theming */

function parseColor(value) {
    if (!value) return null;
    const probe = document.createElement('span');
    probe.style.cssText = 'display:none;color:initial';
    probe.style.color = value;
    (document.body ?? document.documentElement).append(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    const parts = computed.match(/-?[\d.]+/gu)?.map(Number);
    if (!parts || parts.length < 3) return null;
    const [r, g, b, a = 1] = parts;
    return a < 0.15 ? null : { r, g, b };
}

function isDarkSurface() {
    const styles = getComputedStyle(document.documentElement);
    const candidates = [
        styles.getPropertyValue('--SmartThemeBlurTintColor').trim(),
        document.body && getComputedStyle(document.body).backgroundColor,
        styles.backgroundColor,
    ];
    for (const candidate of candidates) {
        const color = parseColor(candidate);
        if (!color) continue;
        return (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255 < 0.5;
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
}

const APPEARANCE_ICONS = { theme: 'fa-circle-half-stroke', light: 'fa-sun', dark: 'fa-moon' };
const APPEARANCE_LABELS = { theme: 'appearanceTheme', light: 'appearanceLight', dark: 'appearanceDark' };

function appearanceButtonHtml() {
    const mode = settings.appearance;
    const label = `${t('appearance')}: ${t(APPEARANCE_LABELS[mode])}`;
    return iconButton({ act: 'cycle-appearance', icon: APPEARANCE_ICONS[mode], label });
}

function syncTheme() {
    if (!root) return;
    const linked = settings.appearance === 'theme';
    root.classList.toggle('is-theme-linked', linked);
    root.classList.toggle('is-dark', linked ? isDarkSurface() : settings.appearance === 'dark');
    if (!linked) {
        for (const property of ['--prpt-theme-text', '--prpt-theme-accent', '--prpt-theme-panel', '--prpt-theme-border']) root.style.removeProperty(property);
        return;
    }
    const styleSources = [getComputedStyle(document.documentElement), document.body && getComputedStyle(document.body)].filter(Boolean);
    const read = (...names) => names.flatMap(name => styleSources.map(styles => styles.getPropertyValue(name).trim())).find(Boolean);
    const colors = {
        '--prpt-theme-text': read('--SmartThemeBodyColor', '--SmartThemeEmColor'),
        '--prpt-theme-accent': read('--SmartThemeQuoteColor', '--SmartThemeEmColor', '--SmartThemeBodyColor'),
        '--prpt-theme-panel': read('--SmartThemeBlurTintColor', '--SmartThemeBotMesBlurTintColor', '--SmartThemeUserMesBlurTintColor'),
        '--prpt-theme-border': read('--SmartThemeBorderColor', '--SmartThemeEmColor', '--SmartThemeBodyColor'),
    };
    for (const [property, value] of Object.entries(colors)) {
        if (value) root.style.setProperty(property, value);
        else root.style.removeProperty(property);
    }
}

/* ----------------------------------------------------------------- render */

function renderQuickSlots(presets, selected) {
    const byName = new Map(presets.map(preset => [preset.name, preset]));
    return Array.from({ length: settings.slotCount }, (_, index) => {
        const name = settings.quickSlots[index];
        const preset = byName.get(name);
        const isActive = Boolean(preset) && preset.value === selected?.value;
        const displayName = preset?.name ?? (name ? name : t('emptySlot'));
        return `<div class="prpt-slot ${preset ? 'has-preset' : 'is-empty'} ${isActive ? 'is-active' : ''}"${attrs({ slot: index })}>
            <button type="button" class="prpt-slot-main" data-act="slot-open"${attrs({ slot: index })} title="${escapeAttr(preset ? preset.name : t('pin'))}">
                <span class="prpt-slot-badge">${preset ? index + 1 : '+'}</span>
                <span class="prpt-slot-name">${escapeHtml(displayName)}</span>
            </button>
            <div class="prpt-slot-actions">
                ${iconButton({ act: 'slot-pin', icon: 'fa-rotate', label: t('replace'), data: { slot: index } })}
                ${iconButton({ act: 'slot-clear', icon: 'fa-xmark', label: t('clear'), extraClass: 'is-danger', data: { slot: index } })}
            </div>
        </div>`;
    }).join('');
}

function renderPreset(preset, group, selected, index) {
    const active = preset.value === selected?.value;
    const showLatest = index === 0 && preset.version && group.presets.length > 1;
    return `<div class="prpt-preset-wrap ${active ? 'is-active' : ''}" draggable="true"${attrs({ 'preset-name': preset.name, 'preset-value': preset.value })}>
        <button type="button" class="prpt-preset" data-act="select-preset"${attrs({ 'preset-value': preset.value })} title="${escapeAttr(preset.name)}">
            <span class="prpt-preset-name">${escapeHtml(preset.name)}</span>
            <span class="prpt-preset-tags">
                ${preset.copied ? `<span class="prpt-tag is-copy">${escapeHtml(t('copyTag'))}</span>` : ''}
                ${showLatest ? `<span class="prpt-tag is-latest">${escapeHtml(t('latest'))}</span>` : ''}
            </span>
        </button>
        <div class="prpt-preset-actions prpt-menu-host">
            ${iconButton({ act: 'preset-menu', icon: 'fa-ellipsis', label: t('more') })}
        </div>
    </div>`;
}

function renderGroup(group, selected, { anchor = false } = {}) {
    const collapsed = !anchor && settings.collapsedGroups[group.key] !== false;
    const presets = group.presets.map((preset, index) => renderPreset(preset, group, selected, index)).join('');
    return `<section class="prpt-group ${anchor ? 'is-anchor' : ''} ${collapsed ? 'is-collapsed' : ''}"${attrs({ 'group-key': group.key })}>
        <div class="prpt-group-head">
            <button type="button" class="prpt-group-summary" data-act="toggle-group" draggable="true" aria-expanded="${collapsed ? 'false' : 'true'}">
                <span class="prpt-chevron"><i class="fa-solid fa-chevron-down"></i></span>
                <span class="prpt-group-name">${escapeHtml(groupLabel(group))}</span>
                ${group.auto ? `<span class="prpt-kind">${escapeHtml(t('auto'))}</span>` : ''}
                <span class="prpt-count">${group.presets.length}</span>
            </button>
            <div class="prpt-menu-host">${iconButton({ act: 'group-menu', icon: 'fa-ellipsis', label: t('more') })}</div>
        </div>
        <div class="prpt-drawer-body">
            <div class="prpt-presets">${presets}</div>
            <div class="prpt-drawer-tools">
                <button type="button" class="prpt-btn" data-act="open-member-picker"><i class="fa-solid fa-plus"></i>${escapeHtml(t('addPresets'))}</button>
            </div>
            <div class="prpt-picker" data-picker="member" hidden></div>
            <div class="prpt-picker" data-picker="nested" hidden></div>
        </div>
    </section>`;
}

function renderFolder(folder, groups, selected) {
    const collapsed = settings.collapsedFolders[folder.id] === true;
    const anchor = groups.find(group => group.key === folder.anchorGroupKey);
    const children = groups.filter(group => group !== anchor);
    return `<section class="prpt-folder ${collapsed ? 'is-collapsed' : ''}"${attrs({ 'folder-id': folder.id })}>
        <div class="prpt-folder-head">
            <button type="button" class="prpt-folder-summary" data-act="toggle-folder" aria-expanded="${collapsed ? 'false' : 'true'}">
                <span class="prpt-chevron"><i class="fa-solid fa-chevron-down"></i></span>
                <i class="fa-solid fa-folder prpt-folder-icon"></i>
                <span class="prpt-folder-name">${escapeHtml(folder.name || t('parentFolder'))}</span>
                <span class="prpt-count">${children.length}</span>
            </button>
            <div class="prpt-menu-host">${iconButton({ act: 'folder-menu', icon: 'fa-ellipsis', label: t('more') })}</div>
        </div>
        <div class="prpt-folder-body">
            ${anchor ? renderGroup(anchor, selected, { anchor: true }) : ''}
            ${children.map(group => renderGroup(group, selected)).join('')}
        </div>
    </section>`;
}

function renderToolbar(typeGroups) {
    const totalPresets = typeGroups.reduce((sum, group) => sum + group.presets.length, 0);
    const segment = (value, label) => `<button type="button" class="${groupTypeFilter === value ? 'is-active' : ''}" data-act="type-filter"${attrs({ 'type-filter': value })}>${escapeHtml(label)}</button>`;
    const sortOption = (value, label) => `<option value="${value}" ${settings.sortMode === value ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    const chips = typeGroups.map(group =>
        `<button type="button" class="${activeFilter === group.key ? 'is-active' : ''}" data-act="filter"${attrs({ filter: group.key })}>${escapeHtml(groupLabel(group))}<small>${group.presets.length}</small></button>`
    ).join('');
    return `<div class="prpt-toolbar">
        <label class="prpt-search">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="search" value="${escapeAttr(searchTerm)}" placeholder="${escapeAttr(t('search'))}" aria-label="${escapeAttr(t('search'))}">
            ${iconButton({ act: 'clear-search', icon: 'fa-xmark', label: t('clearSearch'), extraClass: 'prpt-search-clear' })}
        </label>
        <div class="prpt-filter-row">
            <div class="prpt-segment">${segment('all', t('all'))}${segment('manual', t('userGroups'))}${segment('auto', t('autoGroups'))}</div>
            <select class="prpt-sort" data-act="sort" title="${escapeAttr(t('sort'))}" aria-label="${escapeAttr(t('sort'))}">
                ${sortOption('version-desc', t('newest'))}${sortOption('version-asc', t('oldest'))}${sortOption('name-asc', t('nameAsc'))}${sortOption('name-desc', t('nameDesc'))}
            </select>
        </div>
        <div class="prpt-chips" ${typeGroups.length > 1 ? '' : 'hidden'}>
            <button type="button" class="${activeFilter === 'all' ? 'is-active' : ''}" data-act="filter"${attrs({ filter: 'all' })}>${escapeHtml(t('all'))}<small>${totalPresets}</small></button>
            ${chips}
        </div>
    </div>`;
}

function render() {
    renderQueued = false;
    if (!root || !document.contains(root)) return;
    closeMenu();
    const scrollHost = root.closest('.scrollableInner') ?? document.scrollingElement;
    const savedScrollTop = scrollHost?.scrollTop;
    const presets = getPresets();
    const selected = getSelected();
    const groups = groupPresets(presets);
    const typeGroups = groups.filter(group => groupTypeFilter === 'all' || (groupTypeFilter === 'manual' ? !group.auto : group.auto));
    const filteredGroups = activeFilter === 'all' ? typeGroups : typeGroups.filter(group => group.key === activeFilter);
    const folders = [...settings.folders].sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }));
    const groupsByFolder = new Map(folders.map(folder => [folder.id, []]));
    const unfiled = [];
    for (const group of filteredGroups) {
        const bucket = groupsByFolder.get(settings.folderAssignments[group.key]);
        bucket ? bucket.push(group) : unfiled.push(group);
    }
    const tree = folders
        .filter(folder => groupsByFolder.get(folder.id).length)
        .map(folder => renderFolder(folder, groupsByFolder.get(folder.id), selected))
        .join('') + unfiled.map(group => renderGroup(group, selected)).join('');

    root.classList.toggle('is-shelf-collapsed', Boolean(settings.shelfCollapsed));
    root.innerHTML = `<div class="prpt-header">
        <button type="button" class="prpt-title" data-act="toggle-shelf" aria-expanded="${settings.shelfCollapsed ? 'false' : 'true'}" title="${escapeAttr(t('shelfToggle'))}">
            <span class="prpt-chevron"><i class="fa-solid fa-chevron-down"></i></span>
            <span class="prpt-title-text"><strong>${escapeHtml(t('title'))}</strong><small>${escapeHtml(t('subtitle'))}</small></span>
        </button>
        <div class="prpt-header-actions">
            ${appearanceButtonHtml()}
            ${iconButton({ act: 'add-group', icon: 'fa-folder-plus', label: t('newGroupAction') })}
            ${iconButton({ act: 'collapse-all', icon: 'fa-list', label: t('collapseAll') })}
        </div>
    </div>
    <div class="prpt-body">
        <div class="prpt-current">
            <span class="prpt-current-dot"></span>
            <span class="prpt-current-label">${escapeHtml(t('currentPreset'))}</span>
            <span class="prpt-current-name" title="${escapeAttr(selected?.name ?? '—')}">${escapeHtml(selected?.name ?? '—')}</span>
        </div>
        <div class="prpt-section-label"><i class="fa-solid fa-bolt"></i>${escapeHtml(t('quick'))}</div>
        <div class="prpt-slots">${renderQuickSlots(presets, selected)}</div>
        ${settings.slotCount < MAX_SLOTS ? `<button type="button" class="prpt-slot-add" data-act="slot-add">+ ${escapeHtml(t('addSlot'))}</button>` : ''}
        <div class="prpt-section-label"><i class="fa-solid fa-layer-group"></i>${escapeHtml(t('title'))}</div>
        ${renderToolbar(typeGroups)}
        <p class="prpt-hint">${escapeHtml(t('dragHint'))}</p>
        <div class="prpt-tree">${tree}</div>
        <div class="prpt-empty" ${tree ? 'hidden' : ''}>${escapeHtml(t('empty'))}</div>
    </div>`;
    applySearch();
    if (scrollHost && Number.isFinite(savedScrollTop)) scrollHost.scrollTop = savedScrollTop;
}

function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(render);
}

/* --------------------------------------------------- search (no re-render) */

function applySearch() {
    if (!root) return;
    const term = searchTerm;
    root.querySelector('.prpt-search-clear')?.toggleAttribute('hidden', !term);
    let anyVisible = false;
    for (const section of root.querySelectorAll('.prpt-group')) {
        let matches = 0;
        for (const row of section.querySelectorAll('.prpt-preset-wrap')) {
            const hit = !term || row.dataset.presetName.toLocaleLowerCase().includes(term);
            row.classList.toggle('prpt-is-hidden', !hit);
            if (hit) matches += 1;
        }
        const visible = !term || matches > 0;
        section.classList.toggle('prpt-is-hidden', !visible);
        if (visible) anyVisible = true;
        if (term) section.classList.remove('is-collapsed');
        else section.classList.toggle('is-collapsed', !section.classList.contains('is-anchor') && settings.collapsedGroups[section.dataset.groupKey] !== false);
    }
    for (const folder of root.querySelectorAll('.prpt-folder')) {
        const hasVisibleChild = Boolean(folder.querySelector('.prpt-group:not(.prpt-is-hidden)'));
        folder.classList.toggle('prpt-is-hidden', !hasVisibleChild);
        if (term && hasVisibleChild) folder.classList.remove('is-collapsed');
    }
    const empty = root.querySelector('.prpt-empty');
    if (empty) {
        empty.textContent = term ? t('noSearchResult') : t('empty');
        empty.toggleAttribute('hidden', anyVisible);
    }
}

/* ------------------------------------------------------------------ menus */

function closeMenu() {
    openMenu?.remove();
    openMenu = null;
    menuOwner?.classList.remove('is-active');
    menuOwner = null;
}

function showMenu(button, html) {
    const host = button.closest('.prpt-menu-host');
    if (!host) return;
    closeMenu();
    const menu = document.createElement('div');
    menu.className = 'prpt-menu';
    menu.innerHTML = html;
    host.append(menu);
    button.classList.add('is-active');
    openMenu = menu;
    menuOwner = button;
    if (menu.getBoundingClientRect().bottom > window.innerHeight - 8) menu.classList.add('is-up');
}

function refreshMenu(html) {
    if (!openMenu) return;
    openMenu.innerHTML = html;
}

function placementSection(currentGroupId) {
    const modeButton = (mode, label) => `<button type="button" class="${placementMode === mode ? 'is-active' : ''}" data-act="menu-mode"${attrs({ mode })}>${escapeHtml(label)}</button>`;
    const groups = settings.groups.filter(group => group.id !== currentGroupId);
    const list = groups.length
        ? groups.map(group => menuItem({ act: 'place-preset', icon: 'fa-folder', label: group.name, data: { 'group-id': group.id } })).join('')
        : '';
    return `<div class="prpt-menu-label">${escapeHtml(t('placeTo'))}</div>
        <div class="prpt-menu-mode">${modeButton('move', t('move'))}${modeButton('copy', t('copy'))}</div>
        <div class="prpt-menu-scroll">${list}</div>
        ${menuItem({ act: 'place-new-group', icon: 'fa-folder-plus', label: t('createAndPlace') })}`;
}

function presetMenuHtml(row) {
    const groupKey = row.closest('.prpt-group')?.dataset.groupKey;
    const isManualPlacement = settings.groups.some(group => group.id === groupKey);
    return `${menuItem({ act: 'rename-preset', icon: 'fa-pen', label: t('renamePreset') })}
        <hr>
        ${placementSection(isManualPlacement ? groupKey : null)}
        <hr>
        ${isManualPlacement ? menuItem({ act: 'remove-member', icon: 'fa-minus', label: t('removeFromGroup') }) : ''}
        ${menuItem({ act: 'delete-preset', icon: 'fa-trash', label: t('deletePreset'), danger: true })}`;
}

function groupMenuHtml(section) {
    const key = section.dataset.groupKey;
    const isManual = settings.groups.some(group => group.id === key);
    const currentFolder = settings.folderAssignments[key] ?? '';
    const folderItems = settings.folders
        .map(folder => menuItem({ act: 'assign-folder', icon: 'fa-folder', label: folder.name || t('parentFolder'), checked: folder.id === currentFolder, data: { 'folder-id': folder.id } }))
        .join('');
    return `${menuItem({ act: 'rename-group', icon: 'fa-pen', label: t('renameGroup') })}
        ${menuItem({ act: 'open-member-picker', icon: 'fa-plus', label: t('addPresets') })}
        ${menuItem({ act: 'open-nested-picker', icon: 'fa-folder-tree', label: t('nestDrawer') })}
        ${settings.folders.length ? `<hr><div class="prpt-menu-label">${escapeHtml(t('parentFolder'))}</div>
        <div class="prpt-menu-scroll">${menuItem({ act: 'assign-folder', icon: 'fa-ban', label: t('noFolder'), checked: !currentFolder, data: { 'folder-id': '' } })}${folderItems}</div>` : ''}
        ${isManual ? `<hr>${menuItem({ act: 'delete-group', icon: 'fa-trash', label: t('deleteGroup'), danger: true })}` : ''}`;
}

function folderMenuHtml() {
    return `${menuItem({ act: 'rename-folder', icon: 'fa-pen', label: t('renameFolder') })}
        ${menuItem({ act: 'detach-folder', icon: 'fa-link-slash', label: t('detachFolder'), danger: true })}`;
}

/* ---------------------------------------------------------------- pickers */

function openPicker(section, kind) {
    const body = section.querySelector('.prpt-drawer-body');
    const picker = body?.querySelector(`[data-picker="${kind}"]`);
    const other = body?.querySelector(`[data-picker="${kind === 'member' ? 'nested' : 'member'}"]`);
    if (!picker) return;
    other?.setAttribute('hidden', '');
    section.classList.remove('is-collapsed');
    if (!picker.hidden) {
        picker.hidden = true;
        return;
    }
    picker.innerHTML = kind === 'member' ? memberPickerHtml(section) : nestedPickerHtml(section);
    picker.hidden = false;
    picker.scrollIntoView({ block: 'nearest' });
}

function memberPickerHtml(section) {
    const group = groupPresets(getPresets()).find(item => item.key === section.dataset.groupKey);
    const members = new Set(group?.presets.map(preset => preset.name) ?? []);
    const addable = getPresets().filter(preset => !members.has(preset.name));
    if (!addable.length) return `<div class="prpt-menu-empty">${escapeHtml(t('noneAddable'))}</div>`;
    return `<div class="prpt-picker-head">${escapeHtml(t('choosePreset'))}</div>
        <div class="prpt-picker-list">${addable.map(preset => `<label><input type="checkbox" value="${escapeAttr(preset.name)}"><span>${escapeHtml(preset.name)}</span></label>`).join('')}</div>
        <div class="prpt-picker-foot">
            <button type="button" class="prpt-btn" data-act="picker-cancel">${escapeHtml(t('cancel'))}</button>
            <button type="button" class="prpt-btn is-primary" data-act="picker-confirm">${escapeHtml(t('confirm'))}</button>
        </div>`;
}

function nestedPickerHtml(section) {
    const parentKey = section.dataset.groupKey;
    const currentFolder = settings.folderAssignments[parentKey];
    const anchors = new Set(settings.folders.map(folder => folder.anchorGroupKey));
    const candidates = groupPresets(getPresets()).filter(group =>
        group.key !== parentKey
        && !anchors.has(group.key)
        && (!currentFolder || settings.folderAssignments[group.key] !== currentFolder));
    if (!candidates.length) return `<div class="prpt-menu-empty">${escapeHtml(t('noneNestable'))}</div>`;
    return `<div class="prpt-picker-head">${escapeHtml(t('chooseDrawer'))}</div>
        <div class="prpt-picker-list">${candidates.map(group =>
        `<button type="button" data-act="attach-drawer"${attrs({ 'drawer-key': group.key })}><i class="fa-solid fa-folder"></i><span>${escapeHtml(groupLabel(group))}</span></button>`).join('')}</div>`;
}

/* --------------------------------------------------------------- mutations */

function ensureManualGroup(key) {
    const existing = settings.groups.find(group => group.id === key);
    if (existing) return existing.id;
    const rendered = groupPresets(getPresets()).find(group => group.key === key);
    if (!rendered) return null;
    const group = { id: uid('group'), name: groupLabel(rendered) };
    settings.groups.push(group);
    for (const preset of rendered.presets) settings.assignments[preset.name] = group.id;
    settings.separatedPresets = settings.separatedPresets.filter(name => !rendered.presets.some(preset => preset.name === name));
    if (settings.folderAssignments[key]) {
        settings.folderAssignments[group.id] = settings.folderAssignments[key];
        delete settings.folderAssignments[key];
    }
    for (const folder of settings.folders) {
        if (folder.anchorGroupKey === key) folder.anchorGroupKey = group.id;
    }
    if (Object.hasOwn(settings.collapsedGroups, key)) {
        settings.collapsedGroups[group.id] = settings.collapsedGroups[key];
        delete settings.collapsedGroups[key];
    }
    if (activeFilter === key) activeFilter = group.id;
    if (groupTypeFilter === 'auto') groupTypeFilter = 'all';
    return group.id;
}

function placePresets(names, groupId, mode) {
    if (!groupId || !names.length) return;
    for (const name of names) applyPresetPlacement(settings.assignments, settings.copiedAssignments, name, groupId, mode);
    if (mode === 'move') {
        const moved = new Set(names);
        settings.separatedPresets = settings.separatedPresets.filter(name => !moved.has(name));
    }
    settings.collapsedGroups[groupId] = false;
    saveAndRender();
    window.toastr?.success(t(mode === 'copy' ? 'copied' : 'moved'));
}

function placeIntoGroupKey(names, key, mode) {
    const groupId = ensureManualGroup(key);
    if (groupId) placePresets(names, groupId, mode);
}

function mergeGroups(sourceKey, targetKey, mode) {
    if (!sourceKey || sourceKey === targetKey) return;
    const source = groupPresets(getPresets()).find(group => group.key === sourceKey);
    if (!source) return;
    const targetId = ensureManualGroup(targetKey);
    if (!targetId || targetId === sourceKey) return;
    const names = source.presets.map(preset => preset.name);
    for (const name of names) applyPresetPlacement(settings.assignments, settings.copiedAssignments, name, targetId, mode);
    if (mode === 'move') {
        settings.groups = settings.groups.filter(group => group.id !== sourceKey);
        const anchored = settings.folders.find(folder => folder.anchorGroupKey === sourceKey);
        if (anchored) detachFolder(anchored.id, { silent: true });
        delete settings.folderAssignments[sourceKey];
        delete settings.collapsedGroups[sourceKey];
        if (activeFilter === sourceKey) activeFilter = targetId;
    }
    settings.collapsedGroups[targetId] = false;
    saveAndRender();
}

function removeFromGroup(name, key) {
    const removed = removePresetPlacement(settings.assignments, settings.copiedAssignments, name, key);
    if (!removed && !settings.separatedPresets.includes(name)) settings.separatedPresets.push(name);
    saveAndRender();
    window.toastr?.info(t('removed'));
}

function createGroup(name) {
    const group = { id: uid('group'), name };
    settings.groups.push(group);
    return group.id;
}

function deleteGroup(id) {
    settings.groups = settings.groups.filter(group => group.id !== id);
    for (const [name, groupId] of Object.entries(settings.assignments)) if (groupId === id) delete settings.assignments[name];
    for (const [name, groupIds] of Object.entries(settings.copiedAssignments)) {
        const remaining = Array.isArray(groupIds) ? groupIds.filter(groupId => groupId !== id) : [];
        if (remaining.length) settings.copiedAssignments[name] = remaining;
        else delete settings.copiedAssignments[name];
    }
    const anchored = settings.folders.find(folder => folder.anchorGroupKey === id);
    if (anchored) detachFolder(anchored.id, { silent: true });
    delete settings.folderAssignments[id];
    delete settings.collapsedGroups[id];
    if (activeFilter === id) activeFilter = 'all';
    saveAndRender();
}

function attachExistingDrawer(parentKey, childKey) {
    if (!parentKey || !childKey || parentKey === childKey) return;
    const anchorId = ensureManualGroup(parentKey);
    const childId = ensureManualGroup(childKey);
    if (!anchorId || !childId || anchorId === childId) return;
    let folder = settings.folders.find(item => item.anchorGroupKey === anchorId)
        ?? settings.folders.find(item => item.id === settings.folderAssignments[anchorId]);
    if (!folder) {
        const anchorGroup = settings.groups.find(group => group.id === anchorId);
        folder = { id: uid('folder'), name: anchorGroup?.name || t('parentFolder'), anchorGroupKey: anchorId };
        settings.folders.push(folder);
        settings.folderAssignments[anchorId] = folder.id;
    }
    settings.folderAssignments[childId] = folder.id;
    settings.collapsedFolders[folder.id] = false;
    settings.collapsedGroups[childId] = false;
    saveAndRender();
}

function detachFolder(id, { silent = false } = {}) {
    settings.folders = settings.folders.filter(folder => folder.id !== id);
    for (const [groupKey, folderId] of Object.entries(settings.folderAssignments)) {
        if (folderId === id) delete settings.folderAssignments[groupKey];
    }
    delete settings.collapsedFolders[id];
    if (!silent) saveAndRender();
}

function pinSlot(index) {
    const selected = getSelected();
    if (!selected || selected.value === 'gui') return;
    settings.quickSlots[index] = selected.name;
    saveAndRender();
    window.toastr?.success(t('saved'));
}

function clearSlot(index) {
    settings.quickSlots[index] = null;
    while (settings.slotCount > 1 && !settings.quickSlots[settings.slotCount - 1]) {
        settings.slotCount -= 1;
        settings.quickSlots.pop();
    }
    saveAndRender();
}

function toggleAllGroups() {
    const groups = groupPresets(getPresets());
    const shouldCollapse = groups.some(group => settings.collapsedGroups[group.key] === false);
    for (const group of groups) settings.collapsedGroups[group.key] = shouldCollapse;
    for (const folder of settings.folders) settings.collapsedFolders[folder.id] = shouldCollapse;
    saveAndRender();
}

async function renamePreset(row) {
    const oldName = row?.dataset.presetName;
    const value = row?.dataset.presetValue;
    const newName = window.prompt(t('renamePreset'), oldName)?.trim();
    if (!oldName || !newName || newName === oldName) return;
    if (getPresets().some(preset => preset.name.toLocaleLowerCase() === newName.toLocaleLowerCase())) {
        window.toastr?.warning(newName, t('duplicateName'));
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
        if (settings.copiedAssignments[oldName]) {
            settings.copiedAssignments[newName] = settings.copiedAssignments[oldName];
            delete settings.copiedAssignments[oldName];
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
        `<div class="prpt-confirm"><strong>${escapeHtml(name)}</strong><p>${escapeHtml(t('deleteWarning'))}</p><div><button data-confirm="cancel">${escapeHtml(t('cancel'))}</button><button data-confirm="delete">${escapeHtml(t('confirmDelete'))}</button></div></div>`,
        t('deleteQuestion'),
        { timeOut: 0, extendedTimeOut: 0, closeButton: true, tapToDismiss: false, escapeHtml: false },
    );
    toast?.on?.('click', '[data-confirm="cancel"]', event => { event.stopPropagation(); window.toastr.clear(toast); });
    toast?.on?.('click', '[data-confirm="delete"]', event => { event.stopPropagation(); window.toastr.clear(toast); execute(); });
}

async function deletePreset(name) {
    const manager = context.getPresetManager?.('openai');
    if (!manager?.deletePreset) return;
    try {
        const deleted = await manager.deletePreset(name);
        if (!deleted) throw new Error('Preset delete request failed');
        delete settings.assignments[name];
        delete settings.copiedAssignments[name];
        settings.quickSlots = settings.quickSlots.map(item => item === name ? null : item);
        settings.separatedPresets = settings.separatedPresets.filter(item => item !== name);
        save();
        queueRender();
    } catch (error) {
        console.error('[PromptShelf] Failed to delete preset', error);
        window.toastr?.error(String(error), t('deletePreset'));
    }
}

/* ----------------------------------------------------------------- events */

const groupKeyOf = element => element.closest('.prpt-group')?.dataset.groupKey;
const rowOf = element => element.closest('.prpt-preset-wrap');

const ACTIONS = {
    'toggle-shelf': () => {
        settings.shelfCollapsed = root.classList.toggle('is-shelf-collapsed');
        root.querySelector('.prpt-title')?.setAttribute('aria-expanded', String(!settings.shelfCollapsed));
        save();
    },
    'cycle-appearance': element => {
        const next = APPEARANCES[(APPEARANCES.indexOf(settings.appearance) + 1) % APPEARANCES.length];
        settings.appearance = next;
        save();
        syncTheme();
        element.outerHTML = appearanceButtonHtml();
        window.toastr?.info(t(APPEARANCE_LABELS[next]), t('appearance'), { timeOut: 1200 });
    },
    'add-group': () => {
        const name = window.prompt(t('newGroup'))?.trim();
        if (!name) return;
        settings.collapsedGroups[createGroup(name)] = false;
        saveAndRender();
    },
    'collapse-all': toggleAllGroups,
    'toggle-group': element => {
        const section = element.closest('.prpt-group');
        const collapsed = section.classList.toggle('is-collapsed');
        settings.collapsedGroups[section.dataset.groupKey] = collapsed;
        element.setAttribute('aria-expanded', String(!collapsed));
        save();
    },
    'toggle-folder': element => {
        const folder = element.closest('.prpt-folder');
        const collapsed = folder.classList.toggle('is-collapsed');
        settings.collapsedFolders[folder.dataset.folderId] = collapsed;
        element.setAttribute('aria-expanded', String(!collapsed));
        save();
    },
    'clear-search': () => {
        searchTerm = '';
        const input = root.querySelector('.prpt-search input');
        if (input) input.value = '';
        applySearch();
    },
    'filter': element => { activeFilter = element.dataset.filter; render(); },
    'type-filter': element => { groupTypeFilter = element.dataset.typeFilter; activeFilter = 'all'; render(); },
    'slot-open': element => {
        const index = Number(element.dataset.slot);
        const preset = getPresets().find(item => item.name === settings.quickSlots[index]);
        if (preset) selectPreset(preset.value);
        else pinSlot(index);
    },
    'slot-pin': element => pinSlot(Number(element.dataset.slot)),
    'slot-clear': element => clearSlot(Number(element.dataset.slot)),
    'slot-add': () => {
        if (settings.slotCount >= MAX_SLOTS) return;
        settings.slotCount += 1;
        settings.quickSlots.push(null);
        saveAndRender();
    },
    'select-preset': element => selectPreset(element.dataset.presetValue),
    'preset-menu': element => {
        placementMode = 'move';
        showMenu(element, presetMenuHtml(rowOf(element)));
    },
    'group-menu': element => showMenu(element, groupMenuHtml(element.closest('.prpt-group'))),
    'folder-menu': element => showMenu(element, folderMenuHtml()),
    'menu-mode': element => {
        placementMode = element.dataset.mode === 'copy' ? 'copy' : 'move';
        const row = rowOf(menuOwner);
        refreshMenu(presetMenuHtml(row));
    },
    'place-preset': element => {
        const name = rowOf(menuOwner)?.dataset.presetName;
        const targetId = element.dataset.groupId;
        const mode = placementMode;
        closeMenu();
        if (name) placePresets([name], targetId, mode);
    },
    'place-new-group': () => {
        const name = rowOf(menuOwner)?.dataset.presetName;
        const mode = placementMode;
        closeMenu();
        if (!name) return;
        const groupName = window.prompt(t('newGroup'))?.trim();
        if (groupName) placePresets([name], createGroup(groupName), mode);
    },
    'rename-preset': () => {
        const row = rowOf(menuOwner);
        closeMenu();
        renamePreset(row);
    },
    'delete-preset': () => {
        const row = rowOf(menuOwner);
        closeMenu();
        confirmDeletePreset(row);
    },
    'remove-member': element => {
        const row = rowOf(menuOwner);
        const key = groupKeyOf(element);
        closeMenu();
        if (row && key) removeFromGroup(row.dataset.presetName, key);
    },
    'rename-group': element => {
        const key = groupKeyOf(element);
        closeMenu();
        const rendered = groupPresets(getPresets()).find(group => group.key === key);
        if (!rendered) return;
        const name = window.prompt(t('renameGroup'), groupLabel(rendered))?.trim();
        if (!name || name === groupLabel(rendered)) return;
        const groupId = ensureManualGroup(key);
        const group = settings.groups.find(item => item.id === groupId);
        if (!group) return;
        group.name = name;
        const anchoredFolder = settings.folders.find(folder => folder.anchorGroupKey === groupId);
        if (anchoredFolder) anchoredFolder.name = name;
        saveAndRender();
    },
    'delete-group': element => {
        const key = groupKeyOf(element);
        closeMenu();
        if (key) deleteGroup(key);
    },
    'assign-folder': element => {
        const key = groupKeyOf(element);
        const folderId = element.dataset.folderId;
        closeMenu();
        if (!key) return;
        const groupId = ensureManualGroup(key) ?? key;
        if (folderId) {
            settings.folderAssignments[groupId] = folderId;
            settings.collapsedFolders[folderId] = false;
        } else {
            delete settings.folderAssignments[groupId];
        }
        saveAndRender();
    },
    'rename-folder': element => {
        const folder = settings.folders.find(item => item.id === element.closest('.prpt-folder')?.dataset.folderId);
        closeMenu();
        if (!folder) return;
        const name = window.prompt(t('renameFolder'), folder.name)?.trim();
        if (!name) return;
        folder.name = name;
        const anchorGroup = settings.groups.find(group => group.id === folder.anchorGroupKey);
        if (anchorGroup) anchorGroup.name = name;
        saveAndRender();
    },
    'detach-folder': element => {
        const id = element.closest('.prpt-folder')?.dataset.folderId;
        closeMenu();
        if (id) detachFolder(id);
    },
    'open-member-picker': element => {
        const section = element.closest('.prpt-group');
        closeMenu();
        if (section) openPicker(section, 'member');
    },
    'open-nested-picker': element => {
        const section = element.closest('.prpt-group');
        closeMenu();
        if (section) openPicker(section, 'nested');
    },
    'picker-cancel': element => { element.closest('.prpt-picker').hidden = true; },
    'picker-confirm': element => {
        const picker = element.closest('.prpt-picker');
        const names = Array.from(picker.querySelectorAll('input:checked'), input => input.value);
        const key = groupKeyOf(element);
        picker.hidden = true;
        if (names.length && key) placeIntoGroupKey(names, key, 'move');
    },
    'attach-drawer': element => attachExistingDrawer(groupKeyOf(element), element.dataset.drawerKey),
};

function bindEvents() {
    root.addEventListener('click', event => {
        const target = event.target.closest('[data-act]');
        if (!target || !root.contains(target)) {
            if (!event.target.closest('.prpt-menu')) closeMenu();
            return;
        }
        const handler = ACTIONS[target.dataset.act];
        if (!handler) return;
        event.preventDefault();
        event.stopPropagation();
        if (!target.closest('.prpt-menu') && target.dataset.act !== 'preset-menu' && target.dataset.act !== 'group-menu' && target.dataset.act !== 'folder-menu') closeMenu();
        handler(target, event);
    });
    root.addEventListener('input', event => {
        if (!event.target.matches('.prpt-search input')) return;
        searchTerm = event.target.value.toLocaleLowerCase().trim();
        applySearch();
    });
    root.addEventListener('change', event => {
        if (event.target.dataset.act !== 'sort') return;
        settings.sortMode = event.target.value;
        saveAndRender();
    });
    document.addEventListener('click', event => {
        if (openMenu && !event.target.closest('.prpt-menu-host')) closeMenu();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeMenu();
    });
    bindDragAndDrop();
}

function setDropTarget(element) {
    if (dropTarget === element) return;
    dropTarget?.classList.remove('is-drop-target');
    dropTarget = element;
    element?.classList.add('is-drop-target');
}

function dropModeOf(event) {
    return event.ctrlKey || event.altKey || event.metaKey ? 'copy' : 'move';
}

function bindDragAndDrop() {
    root.addEventListener('dragstart', event => {
        const summary = event.target.closest?.('.prpt-group-summary');
        const row = event.target.closest?.('.prpt-preset-wrap');
        if (summary) {
            const section = summary.closest('.prpt-group');
            event.dataTransfer.effectAllowed = 'copyMove';
            event.dataTransfer.setData('text/x-prompt-shelf-group', section.dataset.groupKey);
            section.classList.add('is-dragging');
        } else if (row) {
            event.dataTransfer.effectAllowed = 'copyMove';
            event.dataTransfer.setData('text/x-prompt-shelf-name', row.dataset.presetName);
            row.classList.add('is-dragging');
        }
    });
    root.addEventListener('dragend', () => {
        setDropTarget(null);
        root.querySelectorAll('.is-dragging').forEach(element => element.classList.remove('is-dragging'));
    });
    root.addEventListener('dragover', event => {
        const types = Array.from(event.dataTransfer?.types ?? []);
        const draggingGroup = types.includes('text/x-prompt-shelf-group');
        const draggingPreset = types.includes('text/x-prompt-shelf-name');
        if (!draggingGroup && !draggingPreset) return;
        const target = event.target.closest?.('.prpt-group') ?? (draggingGroup ? event.target.closest?.('.prpt-folder') : null);
        if (!target) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = dropModeOf(event);
        setDropTarget(target);
    });
    root.addEventListener('dragleave', event => {
        if (dropTarget && !dropTarget.contains(event.relatedTarget)) setDropTarget(null);
    });
    root.addEventListener('drop', event => {
        const name = event.dataTransfer.getData('text/x-prompt-shelf-name');
        const sourceGroup = event.dataTransfer.getData('text/x-prompt-shelf-group');
        if (!name && !sourceGroup) return;
        const section = event.target.closest?.('.prpt-group');
        const folder = event.target.closest?.('.prpt-folder');
        event.preventDefault();
        const mode = dropModeOf(event);
        setDropTarget(null);
        if (section && name) {
            // A 'move' placement is exclusive, so the preset leaves its previous drawer automatically.
            placeIntoGroupKey([name], section.dataset.groupKey, mode);
        } else if (section && sourceGroup) {
            mergeGroups(sourceGroup, section.dataset.groupKey, mode);
        } else if (folder && sourceGroup) {
            const groupId = ensureManualGroup(sourceGroup) ?? sourceGroup;
            settings.folderAssignments[groupId] = folder.dataset.folderId;
            settings.collapsedFolders[folder.dataset.folderId] = false;
            saveAndRender();
        }
    });
}

/* ------------------------------------------------------------------- boot */

function injectShelf() {
    if (document.getElementById('prpt-shelf')) return true;
    const target = document.querySelector('#openai_api-presets');
    const select = document.querySelector(SELECTOR);
    if (!target || !select) return false;
    root = document.createElement('div');
    root.id = 'prpt-shelf';
    root.hidden = !settings.enabled;
    target.prepend(root);
    syncTheme();
    themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    if (document.body) themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
    select.addEventListener('change', queueRender);
    presetObserver = new MutationObserver(queueRender);
    presetObserver.observe(select, { childList: true, subtree: true, characterData: true });
    bindEvents();
    render();
    return true;
}

function injectExtensionSettings() {
    const container = document.querySelector('#extensions_settings2');
    if (!container || document.getElementById('prpt-extension-settings')) return;
    const panel = document.createElement('div');
    panel.id = 'prpt-extension-settings';
    panel.className = 'extension_container';
    const checkbox = (key, label, checked) => `<label class="checkbox_label"><input data-setting="${key}" type="checkbox" ${checked ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`;
    panel.innerHTML = `<div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header"><b><i class="fa-solid fa-layer-group"></i> ${escapeHtml(t('settingsTitle'))}</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
        <div class="inline-drawer-content">
            ${checkbox('enabled', t('enabled'), settings.enabled)}
            ${checkbox('autoGroup', t('autoGroupSetting'), settings.autoGroup)}
            <label>${escapeHtml(t('sensitivity'))} <output>${Math.round(settings.similarityThreshold * 100)}%</output><input data-setting="similarityThreshold" type="range" min="0.65" max="0.98" step="0.01" value="${settings.similarityThreshold}"></label>
        </div>
    </div>`;
    container.append(panel);
    panel.querySelectorAll('[data-setting]').forEach(input => input.addEventListener('input', () => {
        const key = input.dataset.setting;
        settings[key] = input.type === 'checkbox' ? input.checked : Number(input.value);
        panel.querySelector('output').textContent = `${Math.round(settings.similarityThreshold * 100)}%`;
        if (root) root.hidden = !settings.enabled;
        syncTheme();
        save();
        queueRender();
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
