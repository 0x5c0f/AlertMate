// Vercel serverless wrapper — imports the bundled Express app
// The build step (esbuild) bundles server.ts into dist/server.cjs
// This file re-exports it for the Vercel Node.js runtime.
export { default } from "../dist/server.cjs";
