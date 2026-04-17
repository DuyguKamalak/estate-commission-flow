/* eslint-disable no-console */
/**
 * Cleanup script for stray test data.
 *
 * A pentest session left a transaction in the live database with a
 * `<script>...</script>` property title (harmless — Vue escapes it on
 * render, and the backend's input validation caught every follow-up
 * payload). It still looks unprofessional in the recent-transactions
 * list, so this one-shot script deletes anything whose property title
 * or address contains HTML-like tags, plus any breakdown / stage
 * history rows that referenced it.
 *
 * The app deliberately does NOT expose a public DELETE endpoint for
 * transactions (immutable ledger), so this direct-collection cleanup
 * is the intended escape hatch.
 *
 * Usage (from `backend/`):
 *   npm run cleanup:test-data
 */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection, Types } from 'mongoose';
import { AppModule } from '../app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('CleanupTestData');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const connection = app.get<Connection>(getConnectionToken());

    const transactions = connection.collection('transactions');
    const breakdowns = connection.collection('commission_breakdowns');
    const histories = connection.collection('transaction_stage_histories');

    const htmlTagRegex = /<[^>]+>/;

    const suspicious = await transactions
      .find(
        {
          $or: [
            { propertyTitle: { $regex: htmlTagRegex } },
            { propertyAddress: { $regex: htmlTagRegex } },
          ],
        },
        { projection: { _id: 1, referenceCode: 1, propertyTitle: 1 } },
      )
      .toArray();

    if (suspicious.length === 0) {
      logger.log('No suspicious records found. Nothing to do.');
      return;
    }

    logger.log(`Found ${suspicious.length} suspicious transaction(s):`);
    for (const doc of suspicious) {
      logger.log(
        `  - ${String(doc.referenceCode)} :: ${String(doc.propertyTitle)}`,
      );
    }

    const ids = suspicious.map((d) => d._id as Types.ObjectId);

    const [txResult, bdResult, histResult] = await Promise.all([
      transactions.deleteMany({ _id: { $in: ids } }),
      breakdowns.deleteMany({ transactionId: { $in: ids } }),
      histories.deleteMany({ transactionId: { $in: ids } }),
    ]);

    logger.log(
      `Deleted: ${txResult.deletedCount} transactions, ` +
        `${bdResult.deletedCount} breakdowns, ` +
        `${histResult.deletedCount} stage-history rows.`,
    );
  } finally {
    await app.close();
  }
}

bootstrap().catch((err: unknown) => {
  console.error('[CleanupTestData] Fatal error:', err);
  process.exit(1);
});
