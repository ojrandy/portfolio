import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// The store uses window.setTimeout; node's timers stand in for it (mocked below).
globalThis.window ??= globalThis;
const { default: useCityStore } = await import('./useCityStore.js');

const reset = () => useCityStore.setState({ ride: null, following: null, place: null, focus: null });

test('a ride nobody answers ends at the place after 1.5 s (the 3D loop may be stuck)', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
        reset();
        useCityStore.getState().rideTo('market');
        mock.timers.tick(1400);
        assert.equal(useCityStore.getState().ride?.place, 'market', 'still finding a taxi');
        mock.timers.tick(200);
        assert.equal(useCityStore.getState().ride, null);
        assert.equal(useCityStore.getState().place, 'market');
    } finally {
        mock.timers.reset();
    }
});

test('a ride that started always ends at the place by 125 s; a finished or newer ride is left alone', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
        reset();
        const store = useCityStore.getState();
        store.rideTo('pitch');
        store.rideStarted({ id: 7, type: 'taxi' });
        mock.timers.tick(124000);
        assert.equal(useCityStore.getState().ride?.riding, true, 'still riding at 124 s');
        mock.timers.tick(1100);
        assert.equal(useCityStore.getState().ride, null);
        assert.equal(useCityStore.getState().place, 'pitch');

        // Arrived early, then booked another ride: the first ride's timers don't touch the second one.
        reset();
        useCityStore.getState().rideTo('cinema');
        useCityStore.getState().arrive('cinema');
        mock.timers.tick(1000);
        useCityStore.getState().rideTo('school');
        useCityStore.getState().rideStarted({ id: 9, type: 'taxi' });
        mock.timers.tick(124500); // 125.5 s after the first booking, 124.5 s into the second ride
        assert.equal(useCityStore.getState().ride?.place, 'school');
        assert.equal(useCityStore.getState().ride?.riding, true);
    } finally {
        mock.timers.reset();
    }
});
