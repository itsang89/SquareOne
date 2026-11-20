import { describe, expect, it } from 'vitest';
import { parseMoneyPlus, previewImport, rowRequestId, toEntryRow } from './moneyPlusImport';

const CSV = `\uFEFFExport summary
Item,Value
Bill count,5

Bill details
Date,Category,Amount,Type,Account,Member,Currency,Ledger,Note,Transfer to
2026-11-19 21:39:47,Meal,71.50,Expense,Bank,Me,HKD,Default ledger,"lunch, with ""Al""",
2026-11-18 00:00:00,Salary,1000,Income,Bank,Me,HKD,Default ledger,,
2026-11-17 00:00:00,,60,Transfer,Bank,,HKD,Default ledger,,Octopus
2026-11-16 00:00:00,Meal,10,Expense,Octopus,Me,HKD,Default ledger,,
2026-11-15 00:00:00,Meal,5,Expense,futu,Me,HKD,Default ledger,,
2026-11-14 00:00:00,Meal,0,Expense,Bank,Me,HKD,Default ledger,,
`;

describe('Money+ import', () => {
  const { rows } = parseMoneyPlus(CSV);

  it('parses quotes, BOM and header after the summary', () => {
    expect(rows).toHaveLength(5);
    expect(parseMoneyPlus(CSV).skipped).toBe(1);
    expect(rows[0]).toMatchObject({ amount: 71.5, kind: 'expense', note: 'lunch, with "Al"', account: 'Bank' });
    expect(rows[2]).toMatchObject({ kind: 'transfer', transferTo: 'Octopus' });
  });

  it('previews counts, balances, categories, range', () => {
    const p = previewImport(rows);
    expect(p.counts).toEqual({ expense: 3, income: 1, transfer: 1 });
    expect(p.balances).toEqual({ Bank: 868.5, Octopus: 50, futu: -5 });
    expect(p.categories).toEqual([{ name: 'Meal', kind: 'expense' }, { name: 'Salary', kind: 'income' }]);
    expect([p.from, p.to]).toEqual(['2026-11-15', '2026-11-19']);
  });

  it('request ids are deterministic uuids, unique per row', async () => {
    const ids = await Promise.all(rows.map(rowRequestId));
    expect(ids).toEqual(await Promise.all(parseMoneyPlus(CSV).rows.map(rowRequestId)));
    expect(new Set(ids).size).toBe(5);
    expect(ids[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('maps rows to entries (HKT timestamps, transfer has no category)', async () => {
    const e = await toEntryRow(rows[2], (n) => `acc-${n}`, () => 'cat');
    expect(e).toMatchObject({ kind: 'transfer', account_id: 'acc-Bank', to_account_id: 'acc-Octopus', category_id: null, title: 'Transfer', occurred_at: '2026-11-17T00:00:00+08:00' });
    expect((await toEntryRow(rows[0], (n) => n, () => 'cat')).occurred_at).toBe('2026-11-19T21:39:47+08:00');
  });

  it('rejects non-Money+ files', () => {
    expect(() => parseMoneyPlus('a,b\n1,2')).toThrow(/Not a Money\+/);
  });
});
