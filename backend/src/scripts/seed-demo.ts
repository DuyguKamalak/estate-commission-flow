/* eslint-disable no-console */
/**
 * Demo seed script.
 *
 * Populates MongoDB with a small, deterministic dataset that exercises
 * every transaction stage and produces at least one immutable commission
 * breakdown. Useful for:
 *   - Bringing up a fresh Atlas cluster for demos / reviews.
 *   - Local smoke testing of the dashboard, transaction list,
 *     reports and CSV export in one shot.
 *
 * Usage (from `backend/`):
 *   npm run seed           # seed against the configured MONGODB_URI
 *   SEED_RESET=true npm run seed   # wipe collections first
 *
 * The script boots a minimal NestJS application context so it can
 * reuse the real services (AgentsService, TransactionsService) — that
 * guarantees the data it writes is identical in shape and invariants
 * to anything the live API would produce. No direct model writes.
 */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { AppModule } from '../app.module';
import { TransactionStage } from '../common/enums/transaction-stage.enum';
import { TransactionType } from '../common/enums/transaction-type.enum';
import { AgentsService } from '../modules/agents/agents.service';
import { TransactionsService } from '../modules/transactions/transactions.service';

interface AgentSeed {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface TransactionSeed {
  propertyTitle: string;
  propertyAddress: string;
  transactionType: TransactionType;
  totalServiceFee: number;
  currency: string;
  listingAgentEmail: string;
  sellingAgentEmail: string;
  notes?: string;
  /**
   * Advance the fresh transaction up to (and including) this stage.
   * Omit to leave the transaction in its initial `agreement` stage.
   */
  advanceTo?: TransactionStage;
}

const AGENTS: readonly AgentSeed[] = [
  {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada.lovelace@iceberg.test',
    phone: '+44 20 7946 0001',
  },
  {
    firstName: 'Grace',
    lastName: 'Hopper',
    email: 'grace.hopper@iceberg.test',
    phone: '+44 20 7946 0002',
  },
  {
    firstName: 'Alan',
    lastName: 'Turing',
    email: 'alan.turing@iceberg.test',
    phone: '+44 20 7946 0003',
  },
  {
    firstName: 'Linus',
    lastName: 'Torvalds',
    email: 'linus.torvalds@iceberg.test',
    phone: '+44 20 7946 0004',
  },
];

const TRANSACTIONS: readonly TransactionSeed[] = [
  {
    propertyTitle: 'Primrose Hill penthouse',
    propertyAddress: '12 Primrose Hill, London NW1 8XL',
    transactionType: TransactionType.SALE,
    totalServiceFee: 1_250_000,
    currency: 'GBP',
    listingAgentEmail: 'ada.lovelace@iceberg.test',
    sellingAgentEmail: 'grace.hopper@iceberg.test',
    notes: 'Freshly listed this morning — survey pending.',
  },
  {
    propertyTitle: 'Shoreditch loft',
    propertyAddress: '44 Rivington Street, London EC2A 3AY',
    transactionType: TransactionType.SALE,
    totalServiceFee: 980_000,
    currency: 'GBP',
    listingAgentEmail: 'alan.turing@iceberg.test',
    sellingAgentEmail: 'linus.torvalds@iceberg.test',
    notes: 'Earnest money deposited, contracts being drawn up.',
    advanceTo: TransactionStage.EARNEST_MONEY,
  },
  {
    propertyTitle: 'Kensington maisonette',
    propertyAddress: '7 Cornwall Gardens, London SW7 4AW',
    transactionType: TransactionType.SALE,
    totalServiceFee: 2_400_000,
    currency: 'GBP',
    listingAgentEmail: 'grace.hopper@iceberg.test',
    sellingAgentEmail: 'grace.hopper@iceberg.test',
    notes: 'Title deed in conveyancer review — same-agent case.',
    advanceTo: TransactionStage.TITLE_DEED,
  },
  {
    propertyTitle: 'Canary Wharf 2-bed',
    propertyAddress: '28 South Colonnade, London E14 5EU',
    transactionType: TransactionType.SALE,
    totalServiceFee: 1_499_999,
    currency: 'GBP',
    listingAgentEmail: 'ada.lovelace@iceberg.test',
    sellingAgentEmail: 'linus.torvalds@iceberg.test',
    notes: 'Completed last week; commission breakdown persisted.',
    advanceTo: TransactionStage.COMPLETED,
  },
  {
    propertyTitle: 'Marais studio',
    propertyAddress: '5 Rue des Rosiers, 75004 Paris',
    transactionType: TransactionType.RENT,
    totalServiceFee: 180_000,
    currency: 'EUR',
    listingAgentEmail: 'alan.turing@iceberg.test',
    sellingAgentEmail: 'ada.lovelace@iceberg.test',
    notes: 'Cross-currency sample so reports show two currencies.',
    advanceTo: TransactionStage.COMPLETED,
  },
];

const STAGES_IN_ORDER: readonly TransactionStage[] = [
  TransactionStage.AGREEMENT,
  TransactionStage.EARNEST_MONEY,
  TransactionStage.TITLE_DEED,
  TransactionStage.COMPLETED,
];

async function bootstrap(): Promise<void> {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const agentsService = app.get(AgentsService);
    const transactionsService = app.get(TransactionsService);
    const connection = app.get<Connection>(getConnectionToken());

    if (process.env.SEED_RESET === 'true') {
      logger.warn('SEED_RESET=true — wiping demo collections first');
      const db = connection.db;
      if (!db) {
        throw new Error('Mongo connection is not ready.');
      }
      // Collection names must match the `@Schema({ collection: ... })`
      // values from each module — Mongoose does NOT pluralise these.
      await Promise.all([
        db.collection('agents').deleteMany({}),
        db.collection('transactions').deleteMany({}),
        db.collection('transaction_stage_history').deleteMany({}),
        db.collection('commission_breakdowns').deleteMany({}),
      ]);
    }

    const agentIdsByEmail = new Map<string, string>();
    for (const agent of AGENTS) {
      const existing = await agentsService.findByEmailOrNull(agent.email);
      if (existing) {
        agentIdsByEmail.set(agent.email, existing._id.toString());
        logger.log(
          `Agent already exists: ${agent.email} (${existing._id.toString()})`,
        );
        continue;
      }
      const created = await agentsService.create(agent);
      agentIdsByEmail.set(agent.email, created._id.toString());
      logger.log(
        `Created agent: ${agent.firstName} ${agent.lastName} ` +
          `<${agent.email}> → ${created._id.toString()}`,
      );
    }

    for (const seed of TRANSACTIONS) {
      const listingAgentId = agentIdsByEmail.get(seed.listingAgentEmail);
      const sellingAgentId = agentIdsByEmail.get(seed.sellingAgentEmail);
      if (!listingAgentId || !sellingAgentId) {
        throw new Error(
          `Seed references unknown agent emails: ${seed.listingAgentEmail} / ${seed.sellingAgentEmail}`,
        );
      }

      const tx = await transactionsService.create({
        propertyTitle: seed.propertyTitle,
        propertyAddress: seed.propertyAddress,
        transactionType: seed.transactionType,
        totalServiceFee: seed.totalServiceFee,
        currency: seed.currency,
        listingAgentId,
        sellingAgentId,
        notes: seed.notes,
      });
      logger.log(
        `Created transaction ${tx.referenceCode} → ${tx._id.toString()} ` +
          `(${seed.currency} ${seed.totalServiceFee} minor)`,
      );

      if (!seed.advanceTo) {
        continue;
      }
      const targetIndex = STAGES_IN_ORDER.indexOf(seed.advanceTo);
      for (let i = 1; i <= targetIndex; i += 1) {
        const toStage = STAGES_IN_ORDER[i];
        await transactionsService.advanceStage(tx._id.toString(), {
          toStage,
          reason: `Seeded advancement to ${toStage}`,
          triggeredBy: 'seed-script',
        });
        logger.log(`  ↳ advanced ${tx.referenceCode} → ${toStage}`);
      }
    }

    logger.log('Seed complete.');
    logger.log(
      `Summary: ${AGENTS.length} agents, ${TRANSACTIONS.length} transactions ` +
        `(stages: ${TRANSACTIONS.map((t) => t.advanceTo ?? TransactionStage.AGREEMENT).join(', ')})`,
    );
  } finally {
    await app.close();
  }
}

bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[Seed] Fatal error:', err);
  process.exit(1);
});
