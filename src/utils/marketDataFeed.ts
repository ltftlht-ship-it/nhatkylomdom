import { CandleData } from './candleGenerator';
import { TradeRow } from '../types';

/**
 * Ánh xạ Symbol từ MT5 sang Symbol API của Binance Spot hoặc TradingView Ticker
 */
export function mapSymbolToMarketTicker(symbol?: string): { 
  provider: 'binance' | 'yahoo'; 
  ticker: string;
  tvSymbol: string;
} {
  if (!symbol) {
    return { 
      provider: 'binance', 
      ticker: 'PAXGUSDT', 
      tvSymbol: 'OANDA:XAUUSD' 
    };
  }

  const clean = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Vàng giao ngay (Spot Gold)
  // Binance PAXGUSDT là token bảo chứng 1:1 vàng thật giao ngay tại London LBMA, giá chạy từng giây trùng khớp XAUUSD OANDA/Forex.com
  if (clean.includes('XAU') || clean.includes('GOLD')) {
    return { 
      provider: 'binance', 
      ticker: 'PAXGUSDT', 
      tvSymbol: 'OANDA:XAUUSD' 
    };
  }

  // Tiền mã hóa (Crypto)
  if (clean.includes('BTC')) {
    return { 
      provider: 'binance', 
      ticker: 'BTCUSDT', 
      tvSymbol: 'BINANCE:BTCUSDT' 
    };
  }
  if (clean.includes('ETH')) {
    return { 
      provider: 'binance', 
      ticker: 'ETHUSDT', 
      tvSymbol: 'BINANCE:ETHUSDT' 
    };
  }

  // Các cặp Ngoại hối chính (Forex Pairs)
  if (clean.includes('EURUSD') || clean === 'EUR') {
    return { 
      provider: 'binance', 
      ticker: 'EURUSDT', 
      tvSymbol: 'FX:EURUSD' 
    };
  }
  if (clean.includes('GBPUSD') || clean === 'GBP') {
    return { 
      provider: 'binance', 
      ticker: 'GBPUSDT', 
      tvSymbol: 'FX:GBPUSD' 
    };
  }
  if (clean.includes('USDJPY') || clean === 'JPY') {
    return { 
      provider: 'yahoo', 
      ticker: 'USDJPY=X', 
      tvSymbol: 'FX:USDJPY' 
    };
  }
  if (clean.includes('AUDUSD') || clean === 'AUD') {
    return { 
      provider: 'yahoo', 
      ticker: 'AUDUSD=X', 
      tvSymbol: 'FX:AUDUSD' 
    };
  }

  // Chỉ số chứng khoán Mỹ
  if (clean.includes('US30') || clean.includes('DJ30') || clean.includes('WS30')) {
    return { 
      provider: 'yahoo', 
      ticker: '^DJI', 
      tvSymbol: 'BLACKBULL:US30' 
    };
  }
  if (clean.includes('NAS') || clean.includes('USTEC') || clean.includes('NDX')) {
    return { 
      provider: 'yahoo', 
      ticker: '^IXIC', 
      tvSymbol: 'BLACKBULL:NAS100' 
    };
  }

  // Mặc định cho các cặp khác
  return { 
    provider: 'yahoo', 
    ticker: `${clean}=X`, 
    tvSymbol: `FX:${clean}` 
  };
}

/**
 * Lấy dữ liệu nến Spot thật từ Binance hoặc Yahoo Finance
 * Hỗ trợ tham số `aroundTimestampSeconds`: lấy nến xung quanh thời điểm lệnh đã vào trong quá khứ!
 */
export async function fetchRealMarketCandles(
  symbol: string,
  timeframeMinutes: number = 5,
  timezoneOffsetHours: number = 7,
  aroundTimestampSeconds?: number
): Promise<CandleData[]> {
  const { provider, ticker } = mapSymbolToMarketTicker(symbol);
  const offsetSec = timezoneOffsetHours * 3600;
  const tfSec = Math.max(60, timeframeMinutes * 60);

  try {
    if (provider === 'binance') {
      let interval = '5m';
      if (timeframeMinutes === 1) interval = '1m';
      else if (timeframeMinutes === 15) interval = '15m';
      else if (timeframeMinutes === 60) interval = '1h';
      else if (timeframeMinutes === 240) interval = '4h';
      else if (timeframeMinutes >= 1440) interval = '1d';

      let url = `https://api.binance.com/api/v3/klines?symbol=${ticker}&interval=${interval}&limit=500`;

      // Nếu có mốc thời gian của lệnh trong quá khứ, tải nến xung quanh mốc đó
      if (aroundTimestampSeconds && aroundTimestampSeconds > 0) {
        // Trừ bớt 100 nến trước và 250 nến sau
        const startTimeMs = Math.max(0, (aroundTimestampSeconds - 100 * tfSec)) * 1000;
        const endTimeMs = (aroundTimestampSeconds + 250 * tfSec) * 1000;
        url += `&startTime=${startTimeMs}&endTime=${endTimeMs}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Binance API error: ${res.statusText}`);
      const rawData = await res.json();

      if (Array.isArray(rawData) && rawData.length > 0) {
        return rawData.map((k: any) => ({
          time: Math.floor(Number(k[0]) / 1000) + offsetSec,
          open: Number(Number(k[1]).toFixed(ticker === 'PAXGUSDT' ? 2 : 5)),
          high: Number(Number(k[2]).toFixed(ticker === 'PAXGUSDT' ? 2 : 5)),
          low: Number(Number(k[3]).toFixed(ticker === 'PAXGUSDT' ? 2 : 5)),
          close: Number(Number(k[4]).toFixed(ticker === 'PAXGUSDT' ? 2 : 5)),
          volume: Number(k[5])
        }));
      }
    } else {
      // Yahoo Finance Provider
      let interval = '5m';
      let range = '60d';
      if (timeframeMinutes === 1) {
        interval = '1m';
        range = '7d';
      } else if (timeframeMinutes === 15) {
        interval = '15m';
        range = '60d';
      } else if (timeframeMinutes === 60) {
        interval = '60m';
        range = '730d';
      } else if (timeframeMinutes >= 1440) {
        interval = '1d';
        range = '5y';
      }

      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Yahoo Finance API error: ${res.statusText}`);
      const data = await res.json();

      const result = data?.chart?.result?.[0];
      if (result && result.timestamp && result.indicators?.quote?.[0]) {
        const timestamps = result.timestamp;
        const quote = result.indicators.quote[0];
        const candles: CandleData[] = [];

        for (let i = 0; i < timestamps.length; i++) {
          const t = timestamps[i];
          const o = quote.open?.[i];
          const h = quote.high?.[i];
          const l = quote.low?.[i];
          const c = quote.close?.[i];
          const v = quote.volume?.[i] || 0;

          if (o !== null && o !== undefined && h !== null && l !== null && c !== null) {
            candles.push({
              time: Number(t) + offsetSec,
              open: Number(Number(o).toFixed(ticker.includes('GC') ? 2 : 5)),
              high: Number(Number(h).toFixed(ticker.includes('GC') ? 2 : 5)),
              low: Number(Number(l).toFixed(ticker.includes('GC') ? 2 : 5)),
              close: Number(Number(c).toFixed(ticker.includes('GC') ? 2 : 5)),
              volume: Number(v)
            });
          }
        }

        if (candles.length > 0) {
          return candles;
        }
      }
    }
  } catch (err) {
    console.warn(`Lỗi tải nến thật cho ${symbol} (${ticker}):`, err);
  }

  return [];
}

/**
 * Tự động tạo mã Pine Script chuẩn cho một lệnh để vẽ trực tiếp trên TradingView chính hãng:
 * - Vẽ vạch Entry ngang + Mũi tên điểm vào
 * - Vẽ vạch Cắt Lỗ (Stop Loss)
 * - Vẽ vạch Chốt Lời / Thoát Lệnh (Exit / TP)
 * - Vẽ bảng thông số Risk:Reward, PnL, Ticket
 */
export function generatePineScriptForTrade(trade: TradeRow): string {
  const isBuy = trade.type === 'BUY';
  const entry = Number(trade.open_price) || 0;
  const sl = Number(trade.initial_sl) || (isBuy ? entry * 0.995 : entry * 1.005);
  const exit = Number(trade.close_price) || entry;
  const net = trade.net_pnl !== undefined ? trade.net_pnl : (trade.pnl || 0);
  const rr = trade.weighted_rr !== undefined ? trade.weighted_rr : 0;
  const ticket = trade.ticket || '0000';

  return `//@version=5
indicator("BIG-DEAL Trade #${ticket}", overlay=true)

// Thông số lệnh từ MT5
entryPrice = ${entry.toFixed(2)}
slPrice = ${sl.toFixed(2)}
exitPrice = ${exit.toFixed(2)}

// Vẽ đường ngang mức giá
plot(entryPrice, "Entry Price", color=color.new(color.teal, 10), linewidth=2, style=plot.style_line)
plot(slPrice, "Stop Loss", color=color.new(color.red, 10), linewidth=2, style=plot.style_line)
plot(exitPrice, "Exit Price", color=color.new(${net >= 0 ? 'color.green' : 'color.red'}, 10), linewidth=2, style=plot.style_line)

// Tô màu vùng rủi ro & lợi nhuận
p1 = plot(entryPrice, display=display.none)
p2 = plot(slPrice, display=display.none)
p3 = plot(exitPrice, display=display.none)
fill(p1, p2, color=color.new(color.red, 85), title="Vùng Rủi Ro (SL)")
fill(p1, p3, color=color.new(color.green, 85), title="Vùng Lợi Nhuận (Target)")

// Bảng tóm tắt thông số lệnh
var table infoBox = table.new(position.top_right, 2, 5, bgcolor=color.new(#161b22, 10), border_color=#30363d, border_width=1)
if barstate.islast
    table.cell(infoBox, 0, 0, "Lệnh MT5", text_color=color.gray, text_size=size.small)
    table.cell(infoBox, 1, 0, "${trade.type} ${trade.volume} lot (#${ticket})", text_color=${isBuy ? 'color.green' : 'color.red'}, text_size=size.small)
    table.cell(infoBox, 0, 1, "Điểm Vào (Entry)", text_color=color.gray, text_size=size.small)
    table.cell(infoBox, 1, 1, str.tostring(entryPrice), text_color=color.teal, text_size=size.small)
    table.cell(infoBox, 0, 2, "Cắt Lỗ (SL)", text_color=color.gray, text_size=size.small)
    table.cell(infoBox, 1, 2, str.tostring(slPrice), text_color=color.red, text_size=size.small)
    table.cell(infoBox, 0, 3, "Thoát (Exit)", text_color=color.gray, text_size=size.small)
    table.cell(infoBox, 1, 3, str.tostring(exitPrice), text_color=${net >= 0 ? 'color.green' : 'color.red'}, text_size=size.small)
    table.cell(infoBox, 0, 4, "PnL / R:R", text_color=color.gray, text_size=size.small)
    table.cell(infoBox, 1, 4, "${net >= 0 ? '+' : ''}$${net.toFixed(2)} (${rr >= 0 ? '+' : ''}${rr.toFixed(2)}R)", text_color=${net >= 0 ? 'color.green' : 'color.red'}, text_size=size.small)
`;
}
