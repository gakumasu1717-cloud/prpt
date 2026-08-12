import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAutoGroups, nameSimilarity, parsePresetName, sortPresets } from './grouping.js';

test('extracts common creator version suffixes', () => {
    assert.deepEqual(parsePresetName('감성 프롬프트 13.2'), { original: '감성 프롬프트 13.2', base: '감성 프롬프트', version: '13.2' });
    assert.equal(parsePresetName('Writer Pro v2.1-beta').version, '2.1-beta');
    assert.equal(parsePresetName('Writer Pro (rev 4)').version, '4');
});

test('recognizes simple integer creator versions', () => {
    assert.equal(parsePresetName('테스트 1').version, '1');
    assert.equal(parsePresetName('테스트 12').base, '테스트');
});

test('groups close names and sorts newest versions first', () => {
    const groups = buildAutoGroups([
        { value: 'a', name: '감성 프롬프트 2.0' },
        { value: 'b', name: '감성 프롬프트 13.2' },
        { value: 'c', name: '전투 프롬프트 v1.0' },
    ]);
    assert.equal(groups.length, 2);
    const emotional = groups.find(group => group.base.includes('감성'));
    assert.deepEqual(emotional.presets.map(item => item.version), ['13.2', '2.0']);
});

test('similarity ignores prompt boilerplate and punctuation', () => {
    assert.ok(nameSimilarity('Dream Writer Prompt', 'dream-writer 프롬프트') > 0.9);
});

test('groups simple numbered versions into one less granular drawer', () => {
    const groups = buildAutoGroups(['테스트 1', '테스트 2', '테스트 4'].map((name, index) => ({ value: String(index), name })));
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].presets.map(item => item.original), ['테스트 4', '테스트 2', '테스트 1']);
});

test('sorts full prompt entries by version or name without mutating input', () => {
    const presets = ['테스트 2', '테스트 10', '테스트 1'].map((name, index) => ({ name, original: name, version: parsePresetName(name).version, value: String(index) }));
    assert.deepEqual(sortPresets(presets, 'version-desc').map(item => item.name), ['테스트 10', '테스트 2', '테스트 1']);
    assert.deepEqual(sortPresets(presets, 'version-asc').map(item => item.name), ['테스트 1', '테스트 2', '테스트 10']);
    assert.deepEqual(sortPresets(presets, 'name-asc').map(item => item.name), ['테스트 1', '테스트 2', '테스트 10']);
    assert.equal(presets[0].name, '테스트 2');
});
