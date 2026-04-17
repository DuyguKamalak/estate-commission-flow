import { ErrorCode } from '../../../common/enums/error-code.enum';
import { DomainException } from '../../../common/exceptions/domain.exception';
import { TransactionStage } from '../../../common/enums/transaction-stage.enum';
import {
  assertValidStageTransition,
  canTransition,
  isTerminalStage,
  nextStage,
} from './stage-machine';

describe('transaction stage machine', () => {
  describe('nextStage', () => {
    it('returns the next stage in the linear sequence', () => {
      expect(nextStage(TransactionStage.AGREEMENT)).toBe(
        TransactionStage.EARNEST_MONEY,
      );
      expect(nextStage(TransactionStage.EARNEST_MONEY)).toBe(
        TransactionStage.TITLE_DEED,
      );
      expect(nextStage(TransactionStage.TITLE_DEED)).toBe(
        TransactionStage.COMPLETED,
      );
    });

    it('returns null at the terminal stage', () => {
      expect(nextStage(TransactionStage.COMPLETED)).toBeNull();
    });
  });

  describe('assertValidStageTransition — happy path', () => {
    it.each([
      [TransactionStage.AGREEMENT, TransactionStage.EARNEST_MONEY],
      [TransactionStage.EARNEST_MONEY, TransactionStage.TITLE_DEED],
      [TransactionStage.TITLE_DEED, TransactionStage.COMPLETED],
    ])('allows %s -> %s', (from, to) => {
      expect(() => assertValidStageTransition(from, to)).not.toThrow();
    });
  });

  describe('assertValidStageTransition — rejections', () => {
    it('rejects no-op transitions (same stage)', () => {
      for (const stage of [
        TransactionStage.AGREEMENT,
        TransactionStage.EARNEST_MONEY,
        TransactionStage.TITLE_DEED,
      ]) {
        expect(() => assertValidStageTransition(stage, stage)).toThrow(
          DomainException,
        );
      }
    });

    it('rejects any outbound transition from COMPLETED (terminal)', () => {
      for (const to of [
        TransactionStage.AGREEMENT,
        TransactionStage.EARNEST_MONEY,
        TransactionStage.TITLE_DEED,
        TransactionStage.COMPLETED,
      ]) {
        let thrown: unknown;
        try {
          assertValidStageTransition(TransactionStage.COMPLETED, to);
        } catch (err) {
          thrown = err;
        }
        expect(thrown).toBeInstanceOf(DomainException);
        expect((thrown as DomainException).errorCode).toBe(
          ErrorCode.INVALID_STAGE_TRANSITION,
        );
      }
    });

    it('rejects backward transitions', () => {
      expect(() =>
        assertValidStageTransition(
          TransactionStage.TITLE_DEED,
          TransactionStage.AGREEMENT,
        ),
      ).toThrow(DomainException);
      expect(() =>
        assertValidStageTransition(
          TransactionStage.EARNEST_MONEY,
          TransactionStage.AGREEMENT,
        ),
      ).toThrow(DomainException);
    });

    it('rejects skipped stages (must advance one step at a time)', () => {
      expect(() =>
        assertValidStageTransition(
          TransactionStage.AGREEMENT,
          TransactionStage.TITLE_DEED,
        ),
      ).toThrow(DomainException);
      expect(() =>
        assertValidStageTransition(
          TransactionStage.AGREEMENT,
          TransactionStage.COMPLETED,
        ),
      ).toThrow(DomainException);
      expect(() =>
        assertValidStageTransition(
          TransactionStage.EARNEST_MONEY,
          TransactionStage.COMPLETED,
        ),
      ).toThrow(DomainException);
    });

    it('attaches the machine-readable INVALID_STAGE_TRANSITION error code', () => {
      let thrown: unknown;
      try {
        assertValidStageTransition(
          TransactionStage.AGREEMENT,
          TransactionStage.AGREEMENT,
        );
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(DomainException);
      expect((thrown as DomainException).errorCode).toBe(
        ErrorCode.INVALID_STAGE_TRANSITION,
      );
    });

    it('rejects unknown stage values defensively', () => {
      const bogus = 'foobar' as TransactionStage;
      expect(() =>
        assertValidStageTransition(bogus, TransactionStage.AGREEMENT),
      ).toThrow(DomainException);
      expect(() =>
        assertValidStageTransition(TransactionStage.AGREEMENT, bogus),
      ).toThrow(DomainException);
    });
  });

  describe('canTransition', () => {
    it('is a boolean mirror of assertValidStageTransition', () => {
      expect(
        canTransition(
          TransactionStage.AGREEMENT,
          TransactionStage.EARNEST_MONEY,
        ),
      ).toBe(true);
      expect(
        canTransition(
          TransactionStage.AGREEMENT,
          TransactionStage.TITLE_DEED,
        ),
      ).toBe(false);
      expect(
        canTransition(TransactionStage.COMPLETED, TransactionStage.AGREEMENT),
      ).toBe(false);
    });
  });

  describe('isTerminalStage', () => {
    it('is true only for completed', () => {
      expect(isTerminalStage(TransactionStage.COMPLETED)).toBe(true);
      expect(isTerminalStage(TransactionStage.AGREEMENT)).toBe(false);
      expect(isTerminalStage(TransactionStage.EARNEST_MONEY)).toBe(false);
      expect(isTerminalStage(TransactionStage.TITLE_DEED)).toBe(false);
    });
  });
});
