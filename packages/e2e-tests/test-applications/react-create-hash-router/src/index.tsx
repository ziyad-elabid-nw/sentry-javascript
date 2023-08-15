import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
  RouterProvider,
  createHashRouter,
} from 'react-router-dom';
import Index from './pages/Index';
import User from './pages/User';

const replay = new Sentry.Replay();

Sentry.init({
  // environment: 'qa', // dynamic sampling bias to keep transactions
  dsn: process.env.REACT_APP_E2E_TEST_DSN,
  integrations: [
    new Sentry.BrowserTracing({
      routingInstrumentation: Sentry.reactRouterV6Instrumentation(
        React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      ),
    }),
    replay,
  ],
  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control
  tracesSampleRate: 1.0,
  release: 'e2e-test',

  // Always capture replays, so we can test this properly
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 0.0,

  debug: true,
});

Object.defineProperty(window, 'sentryReplayId', {
  get() {
    return replay['_replay'].session.id;
  },
});

Sentry.addGlobalEventProcessor(event => {
  if (
    event.type === 'transaction' &&
    (event.contexts?.trace?.op === 'pageload' || event.contexts?.trace?.op === 'navigation')
  ) {
    const eventId = event.event_id;
    if (eventId) {
      window.recordedTransactions = window.recordedTransactions || [];
      window.recordedTransactions.push(eventId);
    }
  }

  return event;
});

const sentryCreateHashRouter = Sentry.wrapCreateBrowserRouter(createHashRouter);

const router = sentryCreateHashRouter([
  {
    path: '/',
    element: <Index />,
  },
  {
    path: '/user/:id',
    element: <User />,
  },
]);

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(<RouterProvider router={router} />);
