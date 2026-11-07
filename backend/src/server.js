import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { getDatabase } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';

const app = express();

// Initialize DB schema
getDatabase();

app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json());

// Main API Router
app.use('/api', apiRoutes);

// Error Handling
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`[Nint Backend API] Server running on port ${config.port} (${config.nodeEnv})`);
  });
}

export default app;
