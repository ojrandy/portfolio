import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { schoolContent } from './schoolContent.js';

const profile = JSON.parse(readFileSync(new URL('../../content/profile.json', import.meta.url), 'utf8'));
const lesson = (extra) => ({ title: 'Course', venue: null, audience: null, courses: null, date: null, link: null, demo: false, demoFields: [], ...extra });

test('school: only non-demo lessons, without demo fields, TODO dates or unsafe links', () => {
    const school = schoolContent({
        teaching: [
            lesson({ title: 'Placeholder', demo: true }),
            lesson({ title: 'JS', venue: 'Some Institute (SI)', audience: 'first years', date: 'TODO(content) → present', link: 'http://insecure.example' }),
            lesson({ title: 'SQL', venue: 'SI', audience: 'invented', date: '2024 → present', link: 'https://example.com/sql', demoFields: ['audience'] }),
        ],
    });
    assert.deepEqual(school.lessons, [
        { title: 'JS', venue: 'Some Institute (SI)', audience: 'first years', date: null, link: null },
        { title: 'SQL', venue: 'SI', audience: null, date: '2024 → present', link: 'https://example.com/sql' },
    ]);
    assert.equal(school.board, 'SI');
    assert.equal(school.line, null);
});

test('school: the owner\'s teaching line alone is enough; nothing at all gives null', () => {
    assert.deepEqual(schoolContent({ teaching: [], hobbies: [{ name: 'Teaching', text: 'teaching at X' }] }), { lessons: [], line: 'teaching at X', board: null });
    assert.equal(schoolContent({ teaching: [lesson({ demo: true })], hobbies: [{ name: 'Teaching', text: 'TODO(content)' }] }), null);
    assert.equal(schoolContent({}), null);
});

test('school: the real content shows the confirmed TUIB courses with no TODO text', () => {
    const school = schoolContent(profile);
    assert.ok(school.lessons.length >= 1);
    assert.equal(school.board, 'TUIB');
    assert.ok(!JSON.stringify(school).includes('TODO'));
});
