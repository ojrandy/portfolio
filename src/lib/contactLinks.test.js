import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactLinks } from './contactLinks.js';
import profile from '../../content/profile.json' with { type: 'json' };

test('the owner profile gives an email and HTTPS links', () => {
    const { email, links } = contactLinks(profile);
    assert.equal(email, profile.email);
    assert.ok(links.length > 0);
    for (const link of links) assert.match(link.href, /^https:\/\//);
});

test('missing, placeholder or unsafe values are left out', () => {
    const result = contactLinks({
        email: 'TODO(content)',
        links: { linkedin: 'javascript:alert(1)', github: 'http://github.com/x', x: null },
    });
    assert.deepEqual(result, { email: null, links: [] });
    assert.deepEqual(contactLinks(), { email: null, links: [] });
});

test('links keep a fixed order', () => {
    const { links } = contactLinks({ links: { x: 'https://x.com/a', github: 'https://github.com/a', linkedin: 'https://linkedin.com/in/a' } });
    assert.deepEqual(links.map((l) => l.label), ['LinkedIn', 'GitHub', 'X']);
});
