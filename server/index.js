import { createApp } from './app.js';
import { createCityRouter } from './routes/city.js';
import { createBueaRouter } from './routes/buea.js';

// Hostinger provides PORT (it may be a number or a socket path).
const port = process.env.PORT || 3001;
const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production';

const city = createCityRouter();
city.warm();
const buea = createBueaRouter();
buea.warm();

const server = createApp({ routes: [city, buea] }).listen(port, () => {
    const where = /^\d+$/.test(String(port)) ? `http://localhost:${port}` : String(port);
    console.log(`OJ City server listening on ${where} (${mode})`);
});

server.requestTimeout = 30_000;
server.headersTimeout = 20_000;

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
