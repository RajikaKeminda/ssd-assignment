import swaggerJSDoc from 'swagger-jsdoc';
import { env } from './env';

const swaggerDefinition: swaggerJSDoc.OAS3Definition = {
  openapi: '3.0.0',
  info: {
    title: 'Remote Pharmacy Medication Tracker API',
    version: '1.0.0',
    description:
      'API documentation for the Remote Pharmacy Medication Tracker system. ' +
      'Connects customers with remote pharmacies for medication requests and delivery tracking.',
    contact: {
      name: 'API Support',
    },
  },
  servers: [
    {
      url: `http://localhost:${env.PORT}/api`,
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const options: swaggerJSDoc.Options = {
  swaggerDefinition,
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJSDoc(options);
