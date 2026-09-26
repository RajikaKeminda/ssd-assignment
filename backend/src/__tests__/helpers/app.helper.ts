import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from '../../middlewares/error.middleware';
import routes from '../../routes';

export const createTestApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
