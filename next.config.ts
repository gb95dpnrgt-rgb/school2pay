import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Suppress the Sentry CLI output during builds
  silent: !process.env.CI,
  // Upload source maps in CI/production builds only
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});
