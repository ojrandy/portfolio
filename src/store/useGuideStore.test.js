import { test } from 'node:test';
import assert from 'node:assert/strict';
import useGuideStore from './useGuideStore.js';

const sse = (actions) => async () => new Response(
    `event: text\ndata: {"delta":"Here's the Market."}\n\nevent: actions\ndata: ${JSON.stringify({ items: actions })}\n\nevent: done\ndata: {"engine":"guide"}\n\n`,
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
);
const reset = () => useGuideStore.setState({ open: false, pending: false, messages: [], autorun: null, ai: null });

test('a requested action waits for the open panel; an answer after closing never runs one', async () => {
    reset();
    const { setOpen, send } = useGuideStore.getState();
    setOpen(true);
    await send('Take me to the market', { fetchImpl: sse([{ type: 'go_to', place: 'market', auto: true }]) });
    const answer = useGuideStore.getState().messages.at(-1);
    assert.deepEqual(answer.actions, [{ type: 'go_to', place: 'market', auto: true }]);
    assert.equal(useGuideStore.getState().autorun, answer.id);
    setOpen(false);
    assert.equal(useGuideStore.getState().autorun, null);

    // Closed while the answer is on its way.
    setOpen(true);
    const asking = send('Take me to the school', { fetchImpl: sse([{ type: 'go_to', place: 'school', auto: true }]) });
    setOpen(false);
    await asking;
    assert.equal(useGuideStore.getState().autorun, null);

    // An offered action (not asked for) never runs by itself.
    setOpen(true);
    await send('What services does he offer?', { fetchImpl: sse([{ type: 'go_to', place: 'market', auto: false }]) });
    assert.equal(useGuideStore.getState().autorun, null);
});

test('checkAi asks once and treats any failure as off', async () => {
    reset();
    let calls = 0;
    await useGuideStore.getState().checkAi({ fetchImpl: async () => { calls += 1; return Response.json({ ai: true }); } });
    await useGuideStore.getState().checkAi({ fetchImpl: async () => { calls += 1; return Response.json({ ai: false }); } });
    assert.equal(useGuideStore.getState().ai, true);
    assert.equal(calls, 1);
    reset();
    await useGuideStore.getState().checkAi({ fetchImpl: async () => { throw new TypeError('offline'); } });
    assert.equal(useGuideStore.getState().ai, false);
});
