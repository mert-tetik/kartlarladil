import { describe, expect, it } from "vitest";
import { GemOptimisticLedger } from "./gem-optimistic-ledger";

describe("GemOptimisticLedger", () => {
  it("reserves balance immediately and rejects overspending before React rerenders", () => {
    const ledger = new GemOptimisticLedger({ blue: 10, green: 1, purple: 2 });

    const first = ledger.reserve("user-1", "blue", 10);

    expect(first).not.toBeNull();
    expect(ledger.getVisibleBalances()).toEqual({ blue: 0, green: 1, purple: 2 });
    expect(ledger.reserve("user-1", "blue", 10)).toBeNull();
  });

  it("restores a failed reservation without restoring successful reservations", () => {
    const ledger = new GemOptimisticLedger({ blue: 12, green: 0, purple: 0 });
    const first = ledger.reserve("user-1", "blue", 10)!;
    const second = ledger.reserve("user-1", "blue", 2)!;

    ledger.settle(second);
    expect(ledger.getVisibleBalances().blue).toBe(0);

    ledger.rollback(first);
    expect(ledger.getVisibleBalances().blue).toBe(10);
  });

  it("keeps the visible balance correct when responses settle out of order", () => {
    const ledger = new GemOptimisticLedger({ blue: 12, green: 0, purple: 0 });
    const first = ledger.reserve("user-1", "blue", 10)!;
    const second = ledger.reserve("user-1", "blue", 2)!;

    ledger.settle(first);
    expect(ledger.getVisibleBalances().blue).toBe(0);

    ledger.settle(second);
    expect(ledger.getVisibleBalances().blue).toBe(0);
  });

  it("applies a refreshed server balance while preserving still-pending reservations", () => {
    const ledger = new GemOptimisticLedger({ blue: 10, green: 0, purple: 0 });
    const reservation = ledger.reserve("user-1", "blue", 2)!;

    ledger.setConfirmedBalances({ blue: 8, green: 0, purple: 0 });
    expect(ledger.getVisibleBalances().blue).toBe(6);

    ledger.rollback(reservation);
    expect(ledger.getVisibleBalances().blue).toBe(8);
  });
});
