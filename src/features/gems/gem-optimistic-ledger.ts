import type { GemBalances, GemType } from "./gem-types";

export interface GemSpendReservation {
  id: number;
  userId: string;
  type: GemType;
  amount: number;
}

const EMPTY_BALANCES: GemBalances = { blue: 0, green: 0, purple: 0 };

function cloneBalances(balances: GemBalances): GemBalances {
  return { blue: balances.blue, green: balances.green, purple: balances.purple };
}

export class GemOptimisticLedger {
  private confirmedBalances: GemBalances;
  private pendingBalances: GemBalances = cloneBalances(EMPTY_BALANCES);
  private nextReservationId = 0;
  private reservations = new Map<number, GemSpendReservation>();

  constructor(initialBalances: GemBalances = EMPTY_BALANCES) {
    this.confirmedBalances = cloneBalances(initialBalances);
  }

  getVisibleBalances(): GemBalances {
    return {
      blue: Math.max(0, this.confirmedBalances.blue - this.pendingBalances.blue),
      green: Math.max(0, this.confirmedBalances.green - this.pendingBalances.green),
      purple: Math.max(0, this.confirmedBalances.purple - this.pendingBalances.purple),
    };
  }

  getConfirmedBalances(): GemBalances {
    return cloneBalances(this.confirmedBalances);
  }

  setConfirmedBalances(balances: GemBalances) {
    this.confirmedBalances = cloneBalances(balances);
  }

  reset(balances: GemBalances = EMPTY_BALANCES) {
    this.confirmedBalances = cloneBalances(balances);
    this.pendingBalances = cloneBalances(EMPTY_BALANCES);
    this.reservations.clear();
  }

  reserve(userId: string, type: GemType, amount: number): GemSpendReservation | null {
    if (!userId || !Number.isInteger(amount) || amount <= 0) return null;

    const available = this.confirmedBalances[type] - this.pendingBalances[type];
    if (available < amount) return null;

    this.pendingBalances[type] += amount;
    const reservation: GemSpendReservation = {
      id: ++this.nextReservationId,
      userId,
      type,
      amount,
    };
    this.reservations.set(reservation.id, reservation);
    return reservation;
  }

  settle(reservation: GemSpendReservation): boolean {
    const current = this.reservations.get(reservation.id);
    if (!current) return false;

    this.reservations.delete(reservation.id);
    this.pendingBalances[current.type] = Math.max(
      0,
      this.pendingBalances[current.type] - current.amount,
    );
    this.confirmedBalances[current.type] = Math.max(
      0,
      this.confirmedBalances[current.type] - current.amount,
    );
    return true;
  }

  rollback(reservation: GemSpendReservation): boolean {
    const current = this.reservations.get(reservation.id);
    if (!current) return false;

    this.reservations.delete(reservation.id);
    this.pendingBalances[current.type] = Math.max(
      0,
      this.pendingBalances[current.type] - current.amount,
    );
    return true;
  }
}
