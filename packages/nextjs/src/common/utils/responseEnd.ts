import { flush } from '@sentry/core';
import type { Transaction } from '@sentry/types';
import { fill, logger } from '@sentry/utils';
import type { ServerResponse } from 'http';

import type { ResponseEndMethod, WrappedResponseEndMethod } from '../types';

/**
 * Wrap `res.end()` so that it closes the transaction and flushes events before letting the request finish.
 *
 * Note: This wraps a sync method with an async method. While in general that's not a great idea in terms of keeping
 * things in the right order, in this case it's safe, because the native `.end()` actually *is* (effectively) async, and
 * its run actually *is* (literally) awaited, just manually so (which reflects the fact that the core of the
 * request/response code in Node by far predates the introduction of `async`/`await`). When `.end()` is done, it emits
 * the `prefinish` event, and only once that fires does request processing continue. See
 * https://github.com/nodejs/node/commit/7c9b607048f13741173d397795bac37707405ba7.
 *
 * Also note: `res.end()` isn't called until *after* all response data and headers have been sent, so blocking inside of
 * `end` doesn't delay data getting to the end user. See
 * https://nodejs.org/api/http.html#responseenddata-encoding-callback.
 *
 * @param transaction The transaction tracing request handling
 * @param res: The request's corresponding response
 */
export function autoEndTransactionOnResponseEnd(transaction: Transaction, res: ServerResponse): void {
  const wrapEndMethod = (origEnd: ResponseEndMethod): WrappedResponseEndMethod => {
    return function sentryWrappedEnd(this: ServerResponse, ...args: unknown[]) {
      void finishTransaction(transaction, this);
      return origEnd.call(this, ...args);
    };
  };

  // Prevent double-wrapping
  // res.end may be undefined during build when using `next export` to statically export a Next.js app
  if (res.end && !(res.end as WrappedResponseEndMethod).__sentry_original__) {
    fill(res, 'end', wrapEndMethod);
  }
}

/** Finish the given response's transaction and set HTTP status data */
export async function finishTransaction(transaction: Transaction | undefined, res: ServerResponse): Promise<void> {
  if (transaction) {
    transaction.setHttpStatus(res.statusCode);
    transaction.finish();
  }
}

/** Flush the event queue to ensure that events get sent to Sentry before the response is finished and the lambda ends */
export async function flushQueue(): Promise<void> {
  try {
    __DEBUG_BUILD__ && logger.log('Flushing events...');
    await flush(2000);
    __DEBUG_BUILD__ && logger.log('Done flushing events');
  } catch (e) {
    __DEBUG_BUILD__ && logger.log('Error while flushing events:\n', e);
  }
}
