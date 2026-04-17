import * as Joi from 'joi';

/**
 * Environment variable schema.
 *
 * MONGODB_URI is required from Sprint 3 onwards — the app cannot serve
 * traffic without persistence, and failing fast at boot produces a better
 * error than an opaque runtime failure on the first query.
 *
 * During tests (NODE_ENV=test) the URI requirement is relaxed so pure unit
 * test suites (commission calculator, stage machine, utilities) can run
 * without a database, keeping the happy-path feedback loop fast.
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3001),
  API_PREFIX: Joi.string().default('api'),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),

  MONGODB_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .when('NODE_ENV', {
      is: 'test',
      then: Joi.optional().allow(''),
      otherwise: Joi.required(),
    }),

  DEFAULT_CURRENCY: Joi.string().length(3).uppercase().default('GBP'),
});
