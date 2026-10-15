// `npm run dev:server`: development mode (error details in responses), then the normal entry.
process.env.NODE_ENV ??= 'development';
await import('./index.js');
