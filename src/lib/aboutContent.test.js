import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aboutContent } from './aboutContent.js';
import profile from '../../content/profile.json' with { type: 'json' };

test('the real profile has an about section with no demo or TODO text', () => {
    const about = aboutContent(profile);
    assert.ok(about.bio);
    assert.ok(about.origin.length >= 2, 'origin story is split into paragraphs');
    assert.equal(about.place, 'Buea, Cameroon');
    assert.doesNotMatch(JSON.stringify(about), /TODO\(content\)|\[DEMO\]/);
});

test('demo fields and TODO(content) values are left out', () => {
    const about = aboutContent({
        name: 'Test Person',
        title: 'Demo title',
        location: 'TODO(content)',
        degree: 'A degree',
        bio: 'Hello.',
        origin: 'TODO(content)',
        demoFields: ['title'],
    });
    assert.equal(about.name, 'Test Person');
    assert.equal(about.title, null);
    assert.equal(about.place, null);
    assert.equal(about.degree, 'A degree');
    assert.deepEqual(about.origin, []);
});

test('blank lines split the origin story; hobbies map to districts in city order', () => {
    const about = aboutContent({
        origin: 'First.\n\nSecond.\n \nThird.',
        hobbies: [{ name: 'Football', text: 'x' }, { name: 'Coding', text: 'y' }, { name: 'Chess', text: 'z' }],
    });
    assert.equal(about.bio, null);
    assert.deepEqual(about.origin, ['First.', 'Second.', 'Third.']);
    assert.deepEqual(about.districts.map((d) => d.place), ['Downtown', 'Pitch']);
});

test('no bio and no origin story → null (nothing to show)', () => {
    assert.equal(aboutContent({ bio: 'TODO(content)', origin: '' }), null);
    assert.equal(aboutContent(), null);
});
