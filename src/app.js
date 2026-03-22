import path from 'path';
import { fileURLToPath } from 'url';
var __dirname = path.dirname(fileURLToPath(import.meta.url));
import express from 'express';
import { requestId } from './middlewares/requestId.middleware.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { notFoundMiddleware } from './middlewares/notFound.middleware.js';
import v1Routes from './routes/v1/index.js';

var app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestId);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/v1', v1Routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
