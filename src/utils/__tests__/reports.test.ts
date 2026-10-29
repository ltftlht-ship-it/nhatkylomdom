import { describe, it, expect } from 'vitest';
import { buildPositions } from '../reportPositions';
import { summarize, equityCurve, whatIfRespectSl, whatIfFixedTp, partialStats } from '../reportStats';
import { computePsychology, DEFAULT_PSY_SETTINGS } from '../psychologyScore';
import { getPeriodRange } from '../reportPeriods';
import { buildPeriodReport, buildAlerts } from '../reportMessage';
import { EMPTY_PROP_RULES } from '../psychologyScore';

let seq = 0;
function deal(p: Partial<any>): any {
  seq++;
  return {
    id: `d${seq}`, ticket: String(1000 + seq), position_id: String(1000 + seq), account_id: '1',
    symbol: 'XAUUSD', type: 'BUY', volume: 1, open_price: 2000, close_price: 2000, initial_sl: 0,
    pnl: 0, commission: 0, swap: 0, status: 'CLOSED',
    open_time: '2026.10.05 10:00:00', close_time: '2026.10.05 11:00:00',
    pre_checklist_ids: [], post_checklist_ids: [], notes: '', plan_id: null, timeframe: 'M15',
    ...p,
    net_pnl: p.net_pnl ?? (p.pnl ?? 0) + (p.commission ?? 0) + (p.swap ?? 0),
  };
}

describe('Gom cắt từng phần thành 1 vị thế', () => {
  it('3 lần cắt cùng position_id = 1 vị thế, đánh số 1.1 / 1.2 / 1.3, R đúng', () => {
    const legs = [
      deal({ position_id: 'P1', volume: 0.3, close_price: 2010, pnl: 300, close_time: '2026.10.05 10:30:00' }),
      deal({ position_id: 'P1', volume: 0.3, close_price: 2020, pnl: 600, close_time: '2026.10.05 11:00:00' }),
      deal({ position_id: 'P1', volume: 0.4, close_price: 2000.5, pnl: 20, close_time: '2026.10.05 11:30:00' }),
    ].map(d => ({ ...d, initial_sl: 1990 }));
    const pos = buildPositions(legs, 0, false);
    expect(pos).toHaveLength(1);
    expect(pos[0].legs.map(l => l.index)).toEqual(['1.1', '1.2', '1.3']);
    expect(pos[0].net).toBeCloseTo(920);
    expect(pos[0].risk).toBeCloseTo(1000); // 10 giá × 1 lot × 100$/giá
    expect(pos[0].r).toBeCloseTo(0.92);
  });

  it('1R của chỉ số US30 tính từ lãi thật, không đoán hệ số hợp đồng', () => {
    const pos = buildPositions([deal({ symbol: 'US30', open_price: 40000, initial_sl: 39900, close_price: 40100, volume: 1, pnl: 100 })], 0, false);
    expect(pos[0].risk).toBeCloseTo(100);
    expect(pos[0].r).toBeCloseTo(1);
  });

  it('Không đặt SL thì không có R (không giả định 100$)', () => {
    const pos = buildPositions([deal({ pnl: 50, close_price: 2000.5 })], 0, false);
    expect(pos[0].risk).toBe(0);
    expect(pos[0].r).toBeNull();
  });
});

describe('Tổng quan', () => {
  it('Winrate tính trên tổng vị thế (gồm lệnh hòa), PF, chuỗi thua', () => {
    const pos = buildPositions([
      deal({ pnl: 200, close_price: 2002, close_time: '2026.10.05 10:10:00' }),
      deal({ pnl: -100, close_price: 1999, close_time: '2026.10.05 10:20:00' }),
      deal({ pnl: -50, close_price: 1999.5, close_time: '2026.10.05 10:30:00' }),
      deal({ pnl: 0, close_price: 2000, close_time: '2026.10.05 10:40:00' }),
    ], 0, false);
    const s = summarize(pos);
    expect(s.count).toBe(4);
    expect(s.winRate).toBeCloseTo(25);
    expect(s.net).toBeCloseTo(50);
    expect(s.profitFactor).toBeCloseTo(200 / 150);
    expect(s.maxLossStreak).toBe(2);
  });

  it('Max Drawdown tính từ đỉnh vốn', () => {
    const pos = buildPositions([
      deal({ pnl: 500, close_price: 2005, close_time: '2026.10.05 10:10:00' }),
      deal({ pnl: -300, close_price: 1997, close_time: '2026.10.05 10:20:00' }),
      deal({ pnl: -400, close_price: 1996, close_time: '2026.10.05 10:30:00' }),
      deal({ pnl: 100, close_price: 2001, close_time: '2026.10.05 10:40:00' }),
    ], 0, false);
    const eq = equityCurve(pos, 10000);
    expect(eq.maxDrawdown).toBeCloseTo(700);
    expect(eq.endBalance).toBeCloseTo(9900);
  });
});

describe('Điểm Tâm Lý', () => {
  it('Vào lệnh 10 phút sau lệnh thua = trả thù; lot lớn hơn lệnh thua = tăng lot', () => {
    const pos = buildPositions([
      deal({ volume: 1, pnl: -100, close_price: 1999, open_time: '2026.10.05 09:00:00', close_time: '2026.10.05 10:00:00' }),
      deal({ volume: 2, pnl: 50, close_price: 2000.25, open_time: '2026.10.05 10:10:00', close_time: '2026.10.05 10:40:00' }),
      deal({ volume: 1, pnl: 30, close_price: 2000.3, open_time: '2026.10.05 15:00:00', close_time: '2026.10.05 15:30:00' }),
    ], 0, false);
    const res = computePsychology(pos, DEFAULT_PSY_SETTINGS, 0);
    const revenge = res.metrics.find(m => m.id === 'revenge')!;
    const lot = res.metrics.find(m => m.id === 'lot_after_loss')!;
    expect(revenge.offenders).toHaveLength(1);
    expect(lot.offenders).toHaveLength(1);
    expect(lot.sample).toBe(1);
    expect(lot.excluded).toBe(true); // mẫu < 5 không tính điểm tổng
  });

  it('Lỗ vượt 1R bị bắt, lỗ đúng 1R thì không', () => {
    const pos = buildPositions([
      deal({ initial_sl: 1990, pnl: -1000, close_price: 1990 }),
      deal({ initial_sl: 1990, pnl: -2000, close_price: 1980 }),
    ], 0, false);
    const m = computePsychology(pos, DEFAULT_PSY_SETTINGS, 0).metrics.find(x => x.id === 'sl_violation')!;
    expect(m.sample).toBe(2);
    expect(m.offenders).toHaveLength(1);
  });
});

describe('Giả lập', () => {
  it('Tôn trọng SL: lệnh lỗ 2R bị giới hạn còn 1R', () => {
    const pos = buildPositions([deal({ initial_sl: 1990, pnl: -2000, close_price: 1980 })], 0, false);
    const w = whatIfRespectSl(pos);
    expect(w.actual).toBeCloseTo(-2000);
    expect(w.simulated).toBeCloseTo(-1000);
    expect(w.affected).toBe(1);
  });

  it('Chốt cố định 2R: lệnh có MFE 3R thì chốt 2R', () => {
    const pos = buildPositions([deal({ initial_sl: 1990, mfe_price: 2030, pnl: 500, close_price: 2005 })], 0, false);
    expect(pos[0].mfeR).toBeCloseTo(3);
    const w = whatIfFixedTp(pos, 2);
    expect(w.simulated).toBeCloseTo(2000);
  });

  it('Thống kê cắt từng phần theo từng lần cắt', () => {
    const legs = [
      deal({ position_id: 'P9', volume: 0.5, initial_sl: 1990, close_price: 2010, pnl: 500, close_time: '2026.10.05 10:30:00' }),
      deal({ position_id: 'P9', volume: 0.5, initial_sl: 1990, close_price: 2020, pnl: 1000, close_time: '2026.10.05 11:00:00' }),
    ];
    const st = partialStats(buildPositions(legs, 0, false));
    expect(st.scaled.count).toBe(1);
    expect(st.byLeg).toHaveLength(2);
    expect(st.byLeg[1].avgR).toBeCloseTo(1);
  });
});

describe('Kỳ báo cáo', () => {
  it('Tuần bắt đầu từ thứ 2', () => {
    const r = getPeriodRange('WEEK', 0, new Date(2026, 9, 29)); // thứ 5, 29/10/2026
    expect(r.start!.getDay()).toBe(1);
    expect(r.start!.getDate()).toBe(26);
  });
});

describe('Thông báo', () => {
  it('Báo cáo tuần trước: đúng kỳ, đúng PnL, có Điểm Tâm Lý', () => {
    const pos = buildPositions([
      deal({ pnl: 300, close_price: 2003, open_time: '2026.10.20 10:00:00', close_time: '2026.10.20 11:00:00' }),
      deal({ pnl: -100, close_price: 1999, open_time: '2026.10.21 10:00:00', close_time: '2026.10.21 11:00:00' }),
      deal({ pnl: 999, close_price: 2010, open_time: '2026.10.27 10:00:00', close_time: '2026.10.27 11:00:00' }), // tuần này, không tính
    ], 0, false);
    const msg = buildPeriodReport({ accountLabel: 'MT5 #1', all: pos, kind: 'WEEK', now: new Date(2026, 9, 29, 9), psy: DEFAULT_PSY_SETTINGS, prop: EMPTY_PROP_RULES, initialBalance: 10000, plansCount: 0 })!;
    expect(msg).toContain('BÁO CÁO TUẦN');
    expect(msg).toContain('Tuần 19/10/2026 – 25/10/2026');
    expect(msg).toContain('+$200.00');
    expect(msg).toContain('Điểm Tâm Lý');
  });

  it('Kỳ không có lệnh thì không gửi', () => {
    expect(buildPeriodReport({ accountLabel: 'x', all: [], kind: 'MONTH', now: new Date(2026, 9, 29), psy: DEFAULT_PSY_SETTINGS, prop: EMPTY_PROP_RULES, initialBalance: 0, plansCount: 0 })).toBeNull();
  });

  it('Cảnh báo trả thù + tăng lot khi vào lệnh 5 phút sau lệnh thua', () => {
    const pos = buildPositions([deal({ volume: 1, pnl: -100, close_price: 1999, open_time: '2026.10.29 09:00:00', close_time: '2026.10.29 10:00:00' })], 0, false);
    const a = buildAlerts({ accountLabel: 'MT5 #1', all: pos, event: 'OPEN', offsetHours: 0, psy: DEFAULT_PSY_SETTINGS, prop: EMPTY_PROP_RULES, initialBalance: 10000,
      trade: { ticket: '9', symbol: 'XAUUSD', type: 'BUY', volume: 2, open_time: '2026.10.29 10:05:00' } });
    expect(a.join(' ')).toContain('trả thù');
    expect(a.join(' ')).toContain('Tăng lot');
  });

  it('Cảnh báo thua 2 lệnh liền và gần chạm lỗ ngày khi lệnh đóng', () => {
    const pos = buildPositions([
      deal({ position_id: 'A', pnl: -400, close_price: 1996, open_time: '2026.10.29 09:00:00', close_time: '2026.10.29 10:00:00' }),
      deal({ position_id: 'B', pnl: -350, close_price: 1996.5, open_time: '2026.10.29 10:30:00', close_time: '2026.10.29 11:00:00' }),
    ], 0, false);
    const a = buildAlerts({ accountLabel: 'MT5 #1', all: pos, event: 'CLOSED', offsetHours: 0, psy: DEFAULT_PSY_SETTINGS,
      prop: { ...EMPTY_PROP_RULES, dailyLossPct: 1 }, initialBalance: 100000,
      trade: { ticket: 'x', position_id: 'B', symbol: 'XAUUSD', type: 'BUY', volume: 1, open_time: '2026.10.29 10:30:00' } });
    expect(a.join(' ')).toContain('Thua 2 lệnh liền');
    expect(a.join(' ')).toContain('Gần chạm lỗ tối đa ngày');
  });
});