import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { getDatabase } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';

const app = express();

// Initialize DB schema
getDatabase();

app.disable('x-powered-by');

if (config.trustProxy !== false) {
  app.set('trust proxy', config.trustProxy);
}

const allowedOrigins = config.corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAllOrigins = allowedOrigins.includes('*');

app.use(cors({
  origin: allowAllOrigins ? '*' : allowedOrigins,
  credentials: !allowAllOrigins
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.json({ limit: '256kb' }));

// Main API Router
app.use('/api', apiRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error Handling
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`[Nint Backend API] Server running on port ${config.port} (${config.nodeEnv})`);
  });
}

export default app;
