import { expect } from '@playwright/test';

import { sentryTest } from '../../../utils/fixtures';
import { envelopeRequestParser } from '../../../utils/helpers';
import {
  getDecompressedRecordingEvents,
  getReplaySnapshot,
  isReplayEvent,
  REPLAY_DEFAULT_FLUSH_MAX_DELAY,
  shouldSkipReplayTest,
  waitForReplayRequest,
} from '../../../utils/replayHelpers';

sentryTest(
  'should stop recording when running into eventBuffer error',
  async ({ getLocalTestPath, page, forceFlushReplay }) => {
    if (shouldSkipReplayTest()) {
      sentryTest.skip();
    }

    await page.route('https://dsn.ingest.sentry.io/**/*', route => {
      return route.fulfill({
        status: 200,
      });
    });

    const url = await getLocalTestPath({ testDir: __dirname });
    await page.goto(url);

    await waitForReplayRequest(page);
    const replay = await getReplaySnapshot(page);
    expect(replay._isEnabled).toBe(true);

    await forceFlushReplay();

    let called = 0;

    await page.route('https://dsn.ingest.sentry.io/**/*', route => {
      const event = envelopeRequestParser(route.request());

      // We only want to count replays here
      if (event && isReplayEvent(event)) {
        const events = getDecompressedRecordingEvents(route.request());
        // this makes sure we ignore e.g. mouse move events which can otherwise lead to flakes
        if (events.length > 0) {
          called++;
        }
      }

      return route.fulfill({
        status: 200,
      });
    });

    called = 0;

    /**
     * We test the following here:
     * 1. First click should add an event (so the eventbuffer is not empty)
     * 2. Second click should throw an error in eventBuffer (which should lead to stopping the replay)
     * 3. Nothing should be sent to API, as we stop the replay due to the eventBuffer error.
     */
    await page.evaluate(`
window._count = 0;
window._addEvent = window.Replay._replay.eventBuffer.addEvent.bind(window.Replay._replay.eventBuffer);
window.Replay._replay.eventBuffer.addEvent = (...args) => {
  window._count++;
  if (window._count === 2) {
    throw new Error('provoked error');
  }
  window._addEvent(...args);
};
`);

    void page.click('#button1');
    void page.click('#button2');

    // Should immediately skip retrying and just cancel, no backoff
    // This waitForTimeout call should be okay, as we're not checking for any
    // further network requests afterwards.
    await page.waitForTimeout(REPLAY_DEFAULT_FLUSH_MAX_DELAY + 100);

    expect(called).toBe(0);

    const replay2 = await getReplaySnapshot(page);

    expect(replay2._isEnabled).toBe(false);
  },
);
