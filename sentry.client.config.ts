import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Capture 10% of traces in production; 100% in dev/staging
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  // Capture 100% of sessions with replays when an error occurs
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  // Don't report in test environment
  enabled: process.env.NODE_ENV !== "test",
});
