export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  apiPrefix: string;
  frontendUrl: string;
}

export interface DatabaseConfig {
  uri: string;
}

export interface BusinessConfig {
  defaultCurrency: string;
}

export interface RootConfig {
  app: AppConfig;
  database: DatabaseConfig;
  business: BusinessConfig;
}

export default (): RootConfig => ({
  app: {
    nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
    port: parseInt(process.env.PORT ?? '3001', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  },
  database: {
    uri: process.env.MONGODB_URI ?? '',
  },
  business: {
    defaultCurrency: process.env.DEFAULT_CURRENCY ?? 'GBP',
  },
});
