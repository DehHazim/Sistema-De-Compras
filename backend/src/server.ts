import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { pool } from './db/pool.js';
import { startAlertsJob } from './jobs/alerts.js';

async function main() {
  await pool.query('SELECT 1'); // fail-fast se o banco estiver indisponível
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`SIC API ouvindo em http://localhost:${env.PORT}`);
  });

  if (env.NODE_ENV !== 'test') startAlertsJob();

  const shutdown = async (signal: string) => {
    logger.info(`${signal} recebido, encerrando...`);
    server.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Falha ao iniciar a API');
  process.exit(1);
});
