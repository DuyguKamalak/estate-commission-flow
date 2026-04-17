import * as Joi from 'joi';

/**
 * Environment variable schema.
 *
 * MONGODB_URI is intentionally optional at this stage so the app can boot
 * during scaffolding (Sprint 2). Once persistence is wired up in Sprint 3,
 * it will be promoted to `.required()`.
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3001),
  API_PREFIX: Joi.string().default('api'),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),

  MONGODB_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .allow('')
    .optional(),

  DEFAULT_CURRENCY: Joi.string().length(3).uppercase().default('GBP'),
});
