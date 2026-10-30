// @ts-nocheck
// FILE TỰ SINH từ supabase/functions/notify/index.ts — không sửa tay. Chạy: node scripts/build-notify.mjs

// supabase/functions/notify/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

// stub:imageUtils-stub
function normalizeImageSource(s) {
  return s ? String(s).trim() : "";
}

// src/utils/tradeCalculations.ts
function parseChecklistArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed || trimmed === "[]" || trimmed === "{}" || trimmed === "null" || trimmed === "undefined") {
      return [];
    }
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((x) => String(x).trim()).filter(Boolean);
        }
      } catch {
      }
    }
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(",").map((item) => item.replace(/^["']|["']$/g, "").trim()).filter(Boolean);
    }
    if (trimmed.includes(",")) {
      return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return [trimmed];
  }
  return [];
}
var DEFAULT_CONTRACT_SIZES = {
  "XAU/USD": 100,
  "GOLD": 100,
  "EUR/USD": 1e5,
  "GBP/USD": 1e5,
  "USD/JPY": 1e5,
  "BTC/USD": 1,
  "US30": 1,
  "NAS100": 1
};
function determineSession(openTimeStr, timezoneOffsetHours = 0) {
  try {
    const cleanStr = (openTimeStr || "").trim();
    if (!cleanStr) return "\xC2u";
    let hour = 0;
    const timeMatch = cleanStr.match(/(?:\s|T)(\d{1,2}):(\d{1,2})/);
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
    } else {
      const d = new Date(cleanStr.replace(/-/g, "/"));
      if (!isNaN(d.getTime())) hour = d.getHours();
    }
    if (timezoneOffsetHours === 0) {
      if (hour >= 2 && hour < 10) {
        return "\xC1";
      } else if (hour >= 10 && hour < 16) {
        return "\xC2u";
      } else {
        return "M\u1EF9";
      }
    }
    const adjustedHour = (hour + timezoneOffsetHours + 24) % 24;
    if (adjustedHour >= 6 && adjustedHour < 14) {
      return "\xC1";
    } else if (adjustedHour >= 14 && adjustedHour < 20) {
      return "\xC2u";
    } else {
      return "M\u1EF9";
    }
  } catch {
    return "\xC2u";
  }
}
function isGoldSymbol(symbol) {
  if (!symbol) return true;
  const sym = symbol.toUpperCase().trim();
  return sym.includes("XAU") || sym.includes("GOLD");
}
function calculateNetPnl(pnl, commission = 0, swap = 0) {
  return Number(((pnl || 0) + (commission || 0) + (swap || 0)).toFixed(2));
}
function calculatePipSl(openPrice, initialSl = 0, symbol = "XAU/USD") {
  if (!initialSl || initialSl <= 0 || !openPrice || openPrice <= 0) return 0;
  const priceRisk = Math.abs(openPrice - initialSl);
  if (priceRisk <= 0) return 0;
  if (isGoldSymbol(symbol)) {
    return Number(priceRisk.toFixed(2));
  } else {
    return Number((priceRisk * 1e4).toFixed(1));
  }
}
function calculateRisk1R(openPrice, initialSl, volume = 1, contractSize = 100, fixed1RUsd = 100, symbol = "XAU/USD") {
  if (initialSl && initialSl > 0 && openPrice > 0) {
    const priceRisk = Math.abs(openPrice - initialSl);
    if (priceRisk > 0 && volume > 0) {
      const isGold = isGoldSymbol(symbol);
      let riskAmount;
      if (isGold) {
        riskAmount = priceRisk * volume * 100;
      } else {
        const effectiveContract = contractSize > 100 ? contractSize : 1e5;
        riskAmount = priceRisk * volume * effectiveContract;
      }
      if (riskAmount > 0) {
        return Number(riskAmount.toFixed(2));
      }
    }
  }
  return fixed1RUsd > 0 ? fixed1RUsd : 100;
}
function calculateActualRR(netPnl, risk1R) {
  if (!risk1R || risk1R <= 0) return 0;
  return Number((netPnl / risk1R).toFixed(2));
}
function calculateMfeMae(openPrice, initialSl, type, high, low, rawMfePrice, rawMaePrice) {
  const hasHigh = high !== void 0 && high !== null && !isNaN(Number(high)) && Number(high) > 0;
  const hasLow = low !== void 0 && low !== null && !isNaN(Number(low)) && Number(low) > 0;
  const hasRawMfe = rawMfePrice !== void 0 && rawMfePrice !== null && !isNaN(Number(rawMfePrice)) && Number(rawMfePrice) > 0;
  const hasRawMae = rawMaePrice !== void 0 && rawMaePrice !== null && !isNaN(Number(rawMaePrice)) && Number(rawMaePrice) > 0;
  if (!hasHigh && !hasLow && !hasRawMfe && !hasRawMae) {
    return {
      high: null,
      low: null,
      mfe_price: null,
      mae_price: null,
      mfe_dist: null,
      mae_dist: null,
      mfe_r: null,
      mae_r: null
    };
  }
  let mfeDist = null;
  let maeDist = null;
  let marketMfePrice = null;
  let marketMaePrice = null;
  if (hasRawMfe) {
    const val = Number(rawMfePrice);
    marketMfePrice = val;
    if (openPrice > 0 && Math.abs(val - openPrice) < openPrice * 0.5) {
      mfeDist = Math.abs(val - openPrice);
    } else {
      mfeDist = Math.max(0, val);
    }
  }
  if (hasRawMae) {
    const val = Number(rawMaePrice);
    marketMaePrice = val;
    if (openPrice > 0 && Math.abs(val - openPrice) < openPrice * 0.5) {
      maeDist = Math.abs(val - openPrice);
    } else {
      maeDist = Math.max(0, val);
    }
  }
  if (hasHigh || hasLow) {
    const numHigh = hasHigh ? Number(high) : openPrice;
    const numLow = hasLow ? Number(low) : openPrice;
    const distFromHighLow = type === "BUY" ? Math.max(0, numHigh - openPrice) : Math.max(0, openPrice - numLow);
    const maeFromHighLow = type === "BUY" ? Math.max(0, openPrice - numLow) : Math.max(0, numHigh - openPrice);
    if (mfeDist === null || distFromHighLow > mfeDist) {
      mfeDist = distFromHighLow;
      marketMfePrice = type === "BUY" ? numHigh : numLow;
    }
    if (maeDist === null || maeFromHighLow > maeDist) {
      maeDist = maeFromHighLow;
      marketMaePrice = type === "BUY" ? numLow : numHigh;
    }
  }
  const finalMfeDist = mfeDist !== null ? Number(mfeDist.toFixed(2)) : null;
  const finalMaeDist = maeDist !== null ? Number(maeDist.toFixed(2)) : null;
  let mfeR = null;
  let maeR = null;
  if (initialSl > 0 && openPrice > 0) {
    const priceRisk = Math.abs(openPrice - initialSl);
    if (priceRisk > 0) {
      if (finalMfeDist !== null) mfeR = Number((finalMfeDist / priceRisk).toFixed(2));
      if (finalMaeDist !== null) maeR = Number((finalMaeDist / priceRisk).toFixed(2));
    }
  }
  return {
    high: hasHigh ? Number(high) : null,
    low: hasLow ? Number(low) : null,
    mfe_price: marketMfePrice !== null ? Number(marketMfePrice.toFixed(2)) : finalMfeDist,
    mae_price: marketMaePrice !== null ? Number(marketMaePrice.toFixed(2)) : finalMaeDist,
    mfe_dist: finalMfeDist,
    mae_dist: finalMaeDist,
    mfe_r: mfeR,
    mae_r: maeR
  };
}
var NOISE_VOLUME_THRESHOLD = 0.01;
function isNoiseTrade(trade) {
  if ("total_volume" in trade && typeof trade.total_volume === "number") {
    return trade.total_volume <= NOISE_VOLUME_THRESHOLD;
  }
  if ("volume" in trade && typeof trade.volume === "number") {
    return trade.volume <= NOISE_VOLUME_THRESHOLD;
  }
  return false;
}
function processSupabaseClosedTrades(rawTrades, initialBalanceFallback = 1e4, fixed1RUsd = 100, contractSizes = DEFAULT_CONTRACT_SIZES, timezoneOffset = 0) {
  const ticketMap = /* @__PURE__ */ new Map();
  rawTrades.forEach((t) => {
    const st = (t.status || "CLOSED").toUpperCase().trim();
    if (st !== "CLOSED") return;
    if ((t.pnl === null || t.pnl === void 0) && !t.close_time) return;
    const key = String(t.ticket || t.id || "").trim();
    if (key) {
      ticketMap.set(key, t);
    } else {
      ticketMap.set(`row-${Math.random()}`, t);
    }
  });
  const closedTradesOnly = Array.from(ticketMap.values());
  const sorted = [...closedTradesOnly].sort((a, b) => {
    const timeA = new Date((a.close_time || a.open_time || "").replace(/-/g, "/")).getTime() || 0;
    const timeB = new Date((b.close_time || b.open_time || "").replace(/-/g, "/")).getTime() || 0;
    return timeA - timeB;
  });
  const firstWithInitial = sorted.find(
    (t) => t.initial_balance !== void 0 && t.initial_balance !== null && !isNaN(Number(t.initial_balance))
  );
  const initialBalance = firstWithInitial ? Number(firstWithInitial.initial_balance) : initialBalanceFallback;
  let cumulativeNetPnl = 0;
  const processedAscending = sorted.map((t, index) => {
    const pnl = Number(t.pnl || 0);
    const commission = Number(t.commission || 0);
    const swap = Number(t.swap || 0);
    const netPnl = calculateNetPnl(pnl, commission, swap);
    cumulativeNetPnl = Number((cumulativeNetPnl + netPnl).toFixed(2));
    const runningBalance = Number((initialBalance + cumulativeNetPnl).toFixed(2));
    const symbol = t.symbol || "XAU/USD";
    const contractSize = contractSizes[symbol] || (symbol.includes("XAU") || symbol.includes("GOLD") ? 100 : 1e5);
    const openPrice = Number(t.open_price || 0);
    const closePrice = Number(t.close_price || 0);
    const initialSl = t.initial_sl ? Number(t.initial_sl) : 0;
    const volume = Number(t.volume || 0);
    const pipSl = calculatePipSl(openPrice, initialSl, symbol);
    const risk1rUsd = calculateRisk1R(openPrice, initialSl, volume, contractSize, fixed1RUsd, symbol);
    const weightedRr = calculateActualRR(netPnl, risk1rUsd);
    const typeStr = String(t.type || "BUY").toUpperCase();
    let tradeType = typeStr.includes("SELL") ? "SELL" : "BUY";
    if (openPrice > 0 && closePrice > 0 && Math.abs(openPrice - closePrice) > 0.05 && Math.abs(pnl) > 1) {
      if (closePrice > openPrice) {
        tradeType = pnl > 0 ? "BUY" : "SELL";
      } else if (closePrice < openPrice) {
        tradeType = pnl > 0 ? "SELL" : "BUY";
      }
    }
    let result = "BE";
    if (netPnl > 5) result = "Win";
    else if (netPnl < -5) result = "Loss";
    const pnlPercentage = initialBalance > 0 ? Number((netPnl / initialBalance * 100).toFixed(2)) : 0;
    const session = determineSession(t.open_time || "", timezoneOffset);
    const rawHigh = t.high ?? t.trade_high ?? t.max_price ?? t.highest_price;
    const rawLow = t.low ?? t.trade_low ?? t.min_price ?? t.lowest_price;
    const rawMfe = t.mfe_price ?? t.mfe;
    const rawMae = t.mae_price ?? t.mae;
    const mfeMae = calculateMfeMae(openPrice, initialSl, tradeType, rawHigh, rawLow, rawMfe, rawMae);
    const preChecklistIds = parseChecklistArray(t.pre_checklist_ids ?? t.checklist);
    const postChecklistIds = parseChecklistArray(t.post_checklist_ids ?? t.mistake_tags);
    const lostProfit = t.lost_profit !== void 0 && t.lost_profit !== null ? Number(t.lost_profit) : t.plan_pnl && t.plan_pnl > netPnl ? Number((t.plan_pnl - netPnl).toFixed(2)) : 0;
    const rawAccId = t.account_id ?? t.account ?? t.login ?? t.mt5_account ?? t.user_id;
    const accountId = rawAccId ? String(rawAccId).replace(/^acc-/, "").trim() : void 0;
    const rawPostImg = t.ltf_image_url || t.image_base64 || t.image_url_1 || t.close_image || t.image_close || t.close_image_url || t.close_chart || t.exit_image || t.exit_image_url || t.image_url_2 || t.post_image || t.chart_close || t.close_screenshot || t.screenshot_close || t.image_url || "";
    const postTradeImg = normalizeImageSource(rawPostImg);
    const rawPreCandidate = t.htf_image_url || t.pre_image || "";
    const rawPreImg = rawPreCandidate && rawPreCandidate !== rawPostImg ? rawPreCandidate : "";
    const preTradeImg = normalizeImageSource(rawPreImg);
    return {
      id: t.id ? String(t.id) : `sb-${t.ticket || index}-${index}`,
      ticket: String(t.ticket || "000000"),
      position_id: String(t.position_id || t.ticket || "000000"),
      account_id: accountId,
      symbol,
      type: tradeType,
      volume,
      open_price: openPrice,
      close_price: closePrice,
      initial_sl: initialSl,
      pnl,
      commission,
      swap,
      // GIỮ NGUYÊN RAW TIMESTAMP TRONG SUPABASE, KHÔNG GHI ĐÈ OFFSET VÀO ĐÂY
      open_time: t.open_time || "",
      close_time: t.close_time || "",
      pip_sl: pipSl,
      risk_1r_usd: risk1rUsd,
      net_pnl: netPnl,
      weighted_rr: weightedRr,
      lost_profit: lostProfit,
      timeframe: t.timeframe || "M15",
      session,
      image_url_1: postTradeImg,
      image_base64: postTradeImg,
      htf_image_url: preTradeImg,
      ltf_image_url: postTradeImg,
      pre_checklist_ids: preChecklistIds,
      post_checklist_ids: postChecklistIds,
      notes: t.notes || "",
      plan_id: t.plan_id || null,
      plan_name: t.plan_name,
      plan_pnl: t.plan_pnl,
      // MFE / MAE Data
      high: mfeMae.high,
      low: mfeMae.low,
      mfe_price: t.mfe_price ?? t.mfe ?? mfeMae.mfe_price,
      mae_price: t.mae_price ?? t.mae ?? mfeMae.mae_price,
      mfe_dist: mfeMae.mfe_dist,
      mae_dist: mfeMae.mae_dist,
      mfe_r: mfeMae.mfe_r ?? t.mfe_r,
      mae_r: mfeMae.mae_r ?? t.mae_r,
      status: "CLOSED",
      sub_index: t.sub_index,
      tp1_r: t.tp1_r ?? 2.5,
      tp2_r: t.tp2_r ?? 0,
      tp3_r: t.tp3_r ?? 0,
      setup: t.setup || (Array.isArray(t.setups) ? t.setups[0] : void 0),
      setups: Array.isArray(t.setups) ? t.setups : t.setup ? [t.setup] : [],
      result,
      pnl_percentage: pnlPercentage,
      running_balance: runningBalance,
      is_noise: volume <= NOISE_VOLUME_THRESHOLD,
      candles: t.candles || void 0
    };
  });
  return processedAscending.reverse();
}
var processSupabaseTrades = processSupabaseClosedTrades;
function groupTradesByPosition(trades) {
  const groupsMap = /* @__PURE__ */ new Map();
  trades.forEach((t) => {
    const key = t.position_id || t.ticket;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, []);
    }
    groupsMap.get(key).push(t);
  });
  const groups = [];
  groupsMap.forEach((rawSubTrades, posId) => {
    const uniqueDealsMap = /* @__PURE__ */ new Map();
    rawSubTrades.forEach((st) => {
      const tKey = String(st.ticket || st.id || "").trim();
      if (tKey && !uniqueDealsMap.has(tKey)) {
        uniqueDealsMap.set(tKey, st);
      } else if (!tKey) {
        uniqueDealsMap.set(`deal-${Math.random()}`, st);
      }
    });
    let subTrades = Array.from(uniqueDealsMap.values());
    if (subTrades.length > 1) {
      const hasRealDeals = subTrades.some((st) => st.pnl !== null && st.pnl !== void 0 && st.close_time);
      if (hasRealDeals) {
        subTrades = subTrades.filter((st) => st.pnl !== null && st.pnl !== void 0 && Boolean(st.close_time));
      }
    }
    subTrades.sort((a, b) => {
      if (a.sub_index && b.sub_index) {
        return a.sub_index.localeCompare(b.sub_index);
      }
      const timeA = new Date((a.close_time || a.open_time || "").replace(/-/g, "/")).getTime() || 0;
      const timeB = new Date((b.close_time || b.open_time || "").replace(/-/g, "/")).getTime() || 0;
      return timeA - timeB;
    });
    if (!subTrades || subTrades.length === 0) return;
    const master = subTrades[0];
    if (!master) return;
    const latestSubTrade = subTrades[subTrades.length - 1] || master;
    if (subTrades.length > 1) {
      subTrades.forEach((st, idx) => {
        st.sub_index = `1.${idx + 1}`;
      });
    }
    const subTradePostImg = subTrades.map((s) => s.image_base64 || s.ltf_image_url || s.close_image || s.image_close || s.close_image_url || s.image_url_2 || (String(s.status || "").toUpperCase() === "CLOSED" ? s.image_url_1 : "")).find((img) => Boolean(img)) || master.image_base64 || master.ltf_image_url || "";
    const subTradePreImg = subTrades.map((s) => (s.plan_id ? s.image_url_1 : "") || (s.htf_image_url && s.htf_image_url !== subTradePostImg ? s.htf_image_url : "")).find((img) => Boolean(img)) || (master.plan_id ? master.image_url_1 : "") || (master.htf_image_url && master.htf_image_url !== subTradePostImg ? master.htf_image_url : "") || "";
    master.image_base64 = subTradePostImg || master.image_base64 || "";
    master.ltf_image_url = subTradePostImg || master.ltf_image_url || "";
    master.image_url_1 = subTradePreImg || "";
    const subTradeCandles = subTrades.map((s) => s.candles).find((c) => c && (Array.isArray(c) ? c.length > 0 : String(c).length > 2)) || master.candles;
    if (subTradeCandles) {
      master.candles = subTradeCandles;
    }
    const isBuy = master.type === "BUY";
    const highs = subTrades.map((s) => Number(s.high)).filter((h) => !isNaN(h) && h > 0);
    const lows = subTrades.map((s) => Number(s.low)).filter((l) => !isNaN(l) && l > 0);
    const mfePrices = subTrades.map((s) => Number(s.mfe_price)).filter((m) => !isNaN(m) && m > 0);
    const maePrices = subTrades.map((s) => Number(s.mae_price)).filter((m) => !isNaN(m) && m > 0);
    const mfeRs = subTrades.map((s) => Number(s.mfe_r)).filter((r) => !isNaN(r) && r >= 0);
    const maeRs = subTrades.map((s) => Number(s.mae_r)).filter((r) => !isNaN(r) && r >= 0);
    const mfeDists = subTrades.map((s) => Number(s.mfe_dist)).filter((d) => !isNaN(d) && d > 0);
    const maeDists = subTrades.map((s) => Number(s.mae_dist)).filter((d) => !isNaN(d) && d > 0);
    const maxHigh = highs.length > 0 ? Math.max(...highs) : master.high || null;
    const minLow = lows.length > 0 ? Math.min(...lows) : master.low || null;
    const bestMfePrice = mfePrices.length > 0 ? isBuy ? Math.max(...mfePrices) : Math.min(...mfePrices) : master.mfe_price || null;
    const worstMaePrice = maePrices.length > 0 ? isBuy ? Math.min(...maePrices) : Math.max(...maePrices) : master.mae_price || null;
    const maxMfeR = mfeRs.length > 0 ? Math.max(...mfeRs) : master.mfe_r || null;
    const maxMaeR = maeRs.length > 0 ? Math.max(...maeRs) : master.mae_r || null;
    let bestMfeDist = mfeDists.length > 0 ? Math.max(...mfeDists) : master.mfe_dist || null;
    let worstMaeDist = maeDists.length > 0 ? Math.max(...maeDists) : master.mae_dist || null;
    if (bestMfePrice !== null && master.open_price > 0) {
      const calcDist = isBuy ? Math.max(0, bestMfePrice - master.open_price) : Math.max(0, master.open_price - bestMfePrice);
      if (bestMfeDist === null || calcDist > bestMfeDist) {
        bestMfeDist = Number(calcDist.toFixed(2));
      }
    }
    master.high = maxHigh;
    master.low = minLow;
    master.mfe_price = bestMfePrice;
    master.mae_price = worstMaePrice;
    master.mfe_dist = bestMfeDist;
    master.mae_dist = worstMaeDist;
    master.mfe_r = maxMfeR;
    master.mae_r = maxMaeR;
    subTrades.forEach((st) => {
      if ((!st.initial_sl || st.initial_sl <= 0) && master.initial_sl > 0) {
        st.initial_sl = master.initial_sl;
        st.pip_sl = calculatePipSl(st.open_price, st.initial_sl, st.symbol);
        st.risk_1r_usd = calculateRisk1R(st.open_price, st.initial_sl, st.volume, 100, 100, st.symbol);
        st.weighted_rr = calculateActualRR(st.net_pnl, st.risk_1r_usd);
      }
      st.is_noise = isNoiseTrade(st);
    });
    const totalVolume = Number(subTrades.reduce((acc, curr) => acc + curr.volume, 0).toFixed(2));
    const totalGrossPnl = Number(subTrades.reduce((acc, curr) => acc + (curr.pnl || 0), 0).toFixed(2));
    const totalCommission = Number(subTrades.reduce((acc, curr) => acc + (curr.commission || 0), 0).toFixed(2));
    const totalSwap = Number(subTrades.reduce((acc, curr) => acc + (curr.swap || 0), 0).toFixed(2));
    const totalNetPnl = Number((totalGrossPnl + totalCommission + totalSwap).toFixed(2));
    const totalRisk1r = master.initial_sl > 0 && master.open_price > 0 && totalVolume > 0 ? calculateRisk1R(master.open_price, master.initial_sl, totalVolume, 100, 100, master.symbol) : Number(subTrades.reduce((acc, curr) => acc + (curr.risk_1r_usd || 0), 0).toFixed(2));
    const weightedOpenPrice = totalVolume > 0 ? Number((subTrades.reduce((acc, curr) => acc + curr.open_price * curr.volume, 0) / totalVolume).toFixed(2)) : master.open_price;
    const weightedClosePrice = totalVolume > 0 ? Number((subTrades.reduce((acc, curr) => acc + curr.close_price * curr.volume, 0) / totalVolume).toFixed(2)) : master.close_price;
    const combinedRr = totalRisk1r > 0 ? Number((totalNetPnl / totalRisk1r).toFixed(2)) : master.weighted_rr;
    let result = "BE";
    if (totalNetPnl > 5) result = "Win";
    else if (totalNetPnl < -5) result = "Loss";
    const pnlPercent = subTrades.reduce((acc, curr) => acc + (curr.pnl_percentage || 0), 0);
    const isGroupNoise = totalVolume <= NOISE_VOLUME_THRESHOLD;
    groups.push({
      position_id: posId,
      ticket: master.ticket,
      account_id: master.account_id,
      symbol: master.symbol,
      type: master.type,
      total_volume: totalVolume,
      avg_open_price: weightedOpenPrice,
      avg_close_price: weightedClosePrice,
      pip_sl: master.pip_sl,
      initial_sl: master.initial_sl,
      open_time: master.open_time,
      close_time: latestSubTrade.close_time || master.close_time,
      net_pnl: totalNetPnl,
      total_gross_pnl: totalGrossPnl,
      total_commission: totalCommission,
      total_swap: totalSwap,
      total_risk_1r: totalRisk1r,
      weighted_rr: combinedRr,
      pnl_percentage: Number(pnlPercent.toFixed(2)),
      result,
      session: master.session,
      // Running balance của vị thế gom cụm lấy từ lệnh đóng sau cùng
      running_balance: latestSubTrade.running_balance || master.running_balance || 0,
      is_noise: isGroupNoise,
      plan_id: master.plan_id || subTrades.find((s) => s.plan_id)?.plan_id || null,
      plan_name: master.plan_name || subTrades.find((s) => s.plan_name)?.plan_name,
      trades: subTrades,
      master_trade: master
    });
  });
  groups.sort((a, b) => {
    const timeA = new Date((a.close_time || a.open_time || "").replace(/-/g, "/")).getTime() || 0;
    const timeB = new Date((b.close_time || b.open_time || "").replace(/-/g, "/")).getTime() || 0;
    return timeB - timeA;
  });
  return groups;
}

// src/utils/reportPeriods.ts
var pad = (n) => String(n).padStart(2, "0");
var fmt = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
function toDisplayDate(raw, offsetHours) {
  if (!raw) return null;
  const clean = raw.includes("T") ? raw : raw.replace(/[.-]/g, "/");
  const base = new Date(clean);
  if (isNaN(base.getTime())) return null;
  return new Date(base.getTime() + offsetHours * 3600 * 1e3);
}
function getPeriodRange(kind, step, now = /* @__PURE__ */ new Date(), custom) {
  if (kind === "ALL") return { start: null, end: null, label: "To\xE0n b\u1ED9 l\u1ECBch s\u1EED" };
  if (kind === "CUSTOM") {
    const start2 = custom?.from ? /* @__PURE__ */ new Date(`${custom.from}T00:00:00`) : null;
    const endDay = custom?.to ? /* @__PURE__ */ new Date(`${custom.to}T00:00:00`) : null;
    const end2 = endDay ? new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() + 1) : null;
    const label = `${start2 ? fmt(start2) : "\u2026"} \u2013 ${endDay ? fmt(endDay) : "\u2026"}`;
    return { start: start2, end: end2, label };
  }
  if (kind === "WEEK") {
    const dow = (now.getDay() + 6) % 7;
    const start2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + step * 7);
    const end2 = new Date(start2.getFullYear(), start2.getMonth(), start2.getDate() + 7);
    const last = new Date(end2.getFullYear(), end2.getMonth(), end2.getDate() - 1);
    return { start: start2, end: end2, label: `Tu\u1EA7n ${fmt(start2)} \u2013 ${fmt(last)}` };
  }
  if (kind === "MONTH") {
    const start2 = new Date(now.getFullYear(), now.getMonth() + step, 1);
    const end2 = new Date(start2.getFullYear(), start2.getMonth() + 1, 1);
    return { start: start2, end: end2, label: `Th\xE1ng ${pad(start2.getMonth() + 1)}/${start2.getFullYear()}` };
  }
  const q = Math.floor(now.getMonth() / 3) + step;
  const start = new Date(now.getFullYear(), q * 3, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 3, 1);
  return { start, end, label: `Qu\xFD ${Math.floor(start.getMonth() / 3) + 1}/${start.getFullYear()}` };
}

// src/utils/reportPositions.ts
function excursionR(price, open, sl, isBuy, favorable) {
  const p = Number(price);
  if (!(p > 0 && open > 0 && sl > 0)) return null;
  if (Math.abs(p - open) >= open * 0.5) return null;
  const slDist = Math.abs(open - sl);
  if (slDist <= 0) return null;
  const move = isBuy ? p - open : open - p;
  return Math.max(0, favorable ? move : -move) / slDist;
}
function pointValuePerLot(legs, openPrice) {
  for (const s of legs) {
    const move = Math.abs((Number(s.close_price) || 0) - openPrice);
    const vol = Number(s.volume) || 0;
    if (move > openPrice * 1e-6 && vol > 0 && Number(s.pnl)) {
      return Math.abs(Number(s.pnl)) / (move * vol);
    }
  }
  return null;
}
var toArr = (v) => Array.isArray(v) ? v.map(String) : typeof v === "string" && v ? [v] : [];
function buildPositions(trades, offsetHours, hideNoise) {
  const closed = trades.filter((t) => (t.status || "CLOSED").toUpperCase() === "CLOSED");
  const groups = groupTradesByPosition(closed);
  const out = [];
  groups.forEach((g) => {
    const m = g.master_trade;
    const openTime = toDisplayDate(g.open_time, offsetHours);
    const closeTime = toDisplayDate(g.close_time || g.open_time, offsetHours);
    if (!openTime || !closeTime) return;
    const isNoise = g.total_volume > 0 && g.total_volume <= NOISE_VOLUME_THRESHOLD;
    if (hideNoise && isNoise) return;
    const isBuy = String(g.type || "").toUpperCase().startsWith("BUY");
    const sl = Number(g.initial_sl) > 0 ? Number(g.initial_sl) : 0;
    const gross = Number(g.total_gross_pnl ?? 0);
    const net = Number(g.net_pnl ?? 0);
    const openPrice = Number(m.open_price) || Number(g.avg_open_price) || 0;
    const pv = pointValuePerLot(g.trades || [], openPrice);
    const risk = sl > 0 && openPrice > 0 ? pv !== null ? Math.abs(openPrice - sl) * (Number(g.total_volume) || 0) * pv : Number(g.total_risk_1r) || 0 : 0;
    const legs = (g.trades || []).map((s, i) => ({
      index: s.sub_index || `1.${i + 1}`,
      ticket: String(s.ticket),
      volume: Number(s.volume) || 0,
      closePrice: Number(s.close_price) || 0,
      closeTime: toDisplayDate(s.close_time, offsetHours),
      net: Number(s.net_pnl ?? 0),
      r: risk > 0 ? Number(s.net_pnl ?? 0) / risk : null
    }));
    out.push({
      id: `${g.account_id || ""}|${g.position_id}`,
      ticket: String(g.ticket),
      accountId: String(g.account_id || ""),
      symbol: g.symbol,
      isBuy,
      volume: Number(g.total_volume) || 0,
      openPrice,
      closePrice: Number(g.avg_close_price) || 0,
      sl,
      openTime,
      closeTime,
      durationMin: Math.max(0, (closeTime.getTime() - openTime.getTime()) / 6e4),
      session: determineSession(g.open_time, offsetHours),
      net,
      gross,
      fees: Number(g.total_commission ?? 0) + Number(g.total_swap ?? 0),
      risk,
      r: risk > 0 ? net / risk : null,
      grossR: risk > 0 ? gross / risk : null,
      mfeR: excursionR(m.mfe_price, openPrice, sl, isBuy, true),
      maeR: excursionR(m.mae_price, openPrice, sl, isBuy, false),
      legs,
      isScaled: legs.length > 1,
      isNoise,
      planId: g.plan_id || m.plan_id || null,
      setup: m.setup || m.setups && m.setups[0] || "",
      timeframe: m.timeframe || "",
      checklist: toArr(m.pre_checklist_ids),
      mistakes: toArr(m.post_checklist_ids),
      raw: m
    });
  });
  out.sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
  return out;
}

// src/utils/reportStats.ts
function summarize(list) {
  let wins = 0, losses = 0, be = 0, gp = 0, gl = 0, totalR = 0, rCount = 0, fees = 0;
  let streakW = 0, streakL = 0, maxW = 0, maxL = 0;
  let best = null, worst = null;
  const sorted = [...list].sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
  sorted.forEach((p) => {
    if (p.net > 0) {
      wins++;
      gp += p.net;
      streakW++;
      streakL = 0;
    } else if (p.net < 0) {
      losses++;
      gl += -p.net;
      streakL++;
      streakW = 0;
    } else {
      be++;
    }
    maxW = Math.max(maxW, streakW);
    maxL = Math.max(maxL, streakL);
    if (p.r !== null) {
      totalR += p.r;
      rCount++;
    }
    fees += p.fees;
    if (!best || p.net > best.net) best = p;
    if (!worst || p.net < worst.net) worst = p;
  });
  const count = list.length;
  const avgWin = wins ? gp / wins : 0;
  const avgLoss = losses ? gl / losses : 0;
  return {
    count,
    wins,
    losses,
    be,
    winRate: count ? wins / count * 100 : 0,
    net: gp - gl,
    grossProfit: gp,
    grossLoss: gl,
    profitFactor: gl > 0 ? gp / gl : null,
    avgWin,
    avgLoss,
    payoff: avgLoss > 0 ? avgWin / avgLoss : null,
    expectancy: count ? (gp - gl) / count : 0,
    avgR: rCount ? totalR / rCount : null,
    totalR,
    rCount,
    fees,
    maxWinStreak: maxW,
    maxLossStreak: maxL,
    best,
    worst
  };
}
function equityCurve(list, initialBalance) {
  const sorted = [...list].sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
  let bal = initialBalance;
  let peak = initialBalance;
  let maxDd = 0;
  let maxDdPctOfPeak = 0;
  const points = [{ i: 0, label: "B\u1EAFt \u0111\u1EA7u", balance: bal, drawdown: 0 }];
  sorted.forEach((p, idx) => {
    bal += p.net;
    peak = Math.max(peak, bal);
    const dd = bal - peak;
    if (-dd > maxDd) maxDd = -dd;
    if (peak > 0) maxDdPctOfPeak = Math.max(maxDdPctOfPeak, -dd / peak * 100);
    const d = p.closeTime;
    points.push({ i: idx + 1, label: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`, balance: round2(bal), drawdown: round2(dd) });
  });
  return { points, endBalance: bal, maxDrawdown: maxDd, maxDrawdownPct: maxDdPctOfPeak };
}
var pad2 = (n) => String(n).padStart(2, "0");
var round2 = (n) => Math.round(n * 100) / 100;
function fmtMoney(v) {
  return `${v >= 0 ? "+" : "-"}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtR(v) {
  return v === null ? "\u2014" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}R`;
}

// src/utils/psychologyScore.ts
var DEFAULT_PSY_SETTINGS = {
  revengeMinutes: 15,
  maxTradesPerDay: 3,
  greedGapR: 1.5,
  earlyExitMfeR: 2,
  earlyExitMaxR: 1,
  slTolerancePct: 10
};
var MIN_SAMPLE = 5;
var dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
var rateScore = (bad, sample) => sample > 0 ? Math.round(100 - bad / sample * 100) : null;
var rate = (bad, sample) => sample > 0 ? bad / sample * 100 : null;
var sumNet = (list) => list.reduce((s, p) => s + p.net, 0);
var money = (v) => `${v >= 0 ? "+" : "-"}$${Math.abs(v).toFixed(2)}`;
function psyLevel(score) {
  if (score === null) return "Ch\u01B0a \u0111\u1EE7 d\u1EEF li\u1EC7u";
  if (score >= 80) return "V\u1EEFng";
  if (score >= 60) return "C\u1EA7n ch\xFA \xFD";
  if (score >= 40) return "Dao \u0111\u1ED9ng";
  return "M\u1EA5t ki\u1EC3m so\xE1t";
}
function computePsychology(positions, s, plansCount) {
  const rows = [...positions].sort((a, b) => a.openTime.getTime() - b.openTime.getTime());
  const total = rows.length;
  const metrics = [];
  const losses = rows.filter((p) => p.net < 0);
  {
    const win = s.revengeMinutes * 6e4;
    const offenders = rows.filter((p) => losses.some((l) => l !== p && p.openTime.getTime() - l.closeTime.getTime() >= 0 && p.openTime.getTime() - l.closeTime.getTime() <= win));
    metrics.push({ id: "revenge", name: "Tr\u1EA3 th\xF9", unit: "%", sample: total, sampleUnit: "l\u1EC7nh", value: rate(offenders.length, total), score: rateScore(offenders.length, total), offenders });
  }
  {
    let sample = 0;
    const offenders = [];
    losses.forEach((l) => {
      const next = rows.find((p) => p !== l && p.openTime.getTime() >= l.closeTime.getTime());
      if (!next) return;
      sample++;
      if (next.volume > l.volume) offenders.push(next);
    });
    metrics.push({ id: "lot_after_loss", name: "T\u0103ng lot sau thua", unit: "%", sample, sampleUnit: "l\u1EC7nh", value: rate(offenders.length, sample), score: rateScore(offenders.length, sample), offenders });
  }
  const byDay = /* @__PURE__ */ new Map();
  rows.forEach((p) => {
    const k = dayKey(p.openTime);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(p);
  });
  {
    let badDays = 0;
    const offenders = [];
    byDay.forEach((list) => {
      if (list.length > s.maxTradesPerDay) {
        badDays++;
        offenders.push(...list.slice(s.maxTradesPerDay));
      }
    });
    metrics.push({
      id: "overtrade",
      name: "\u0110\xE1nh qu\xE1 tay",
      unit: "%",
      sample: byDay.size,
      sampleUnit: "ng\xE0y",
      value: rate(badDays, byDay.size),
      score: rateScore(badDays, byDay.size),
      offenders,
      note: offenders.length ? `L\u1EC7nh v\u01B0\u1EE3t m\u1EE9c: ${offenders.length} l\u1EC7nh, PnL ${money(sumNet(offenders))}` : void 0
    });
  }
  {
    let streakDays = 0, continued = 0;
    const offenders = [];
    byDay.forEach((list) => {
      const byClose = [...list].sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
      for (let i = 1; i < byClose.length; i++) {
        if (byClose[i - 1].net < 0 && byClose[i].net < 0) {
          streakDays++;
          const after = list.filter((p) => p.openTime.getTime() >= byClose[i].closeTime.getTime());
          if (after.length) {
            continued++;
            offenders.push(...after);
          }
          break;
        }
      }
    });
    metrics.push({
      id: "continue_after_losses",
      name: "Thua 2 l\u1EC7nh li\u1EC1n v\u1EABn \u0111\xE1nh",
      unit: "%",
      sample: streakDays,
      sampleUnit: "ng\xE0y",
      value: rate(continued, streakDays),
      score: rateScore(continued, streakDays),
      offenders,
      note: offenders.length ? `L\u1EC7nh \u0111\xE1nh ti\u1EBFp: ${offenders.length} l\u1EC7nh, PnL ${money(sumNet(offenders))}` : void 0
    });
  }
  {
    const offenders = rows.filter((p) => !(p.sl > 0));
    metrics.push({ id: "no_sl", name: "Kh\xF4ng \u0111\u1EB7t SL", unit: "%", sample: total, sampleUnit: "l\u1EC7nh", value: rate(offenders.length, total), score: rateScore(offenders.length, total), offenders });
  }
  {
    const withSl = losses.filter((p) => p.risk > 0);
    const offenders = withSl.filter((p) => -p.gross > p.risk * (1 + s.slTolerancePct / 100));
    metrics.push({
      id: "sl_violation",
      name: "L\u1ED7 v\u01B0\u1EE3t 1R",
      unit: "%",
      sample: withSl.length,
      sampleUnit: "l\u1EC7nh",
      value: rate(offenders.length, withSl.length),
      score: rateScore(offenders.length, withSl.length),
      offenders,
      note: offenders.length ? `L\u1ED7 th\xEAm ngo\xE0i 1R: ${money(offenders.reduce((t, p) => t + (p.gross + p.risk), 0))}` : void 0
    });
  }
  {
    const w = rows.filter((p) => p.net > 0 && p.durationMin > 0);
    const l = rows.filter((p) => p.net < 0 && p.durationMin > 0);
    let value = null, score2 = null, offenders = [];
    if (w.length && l.length) {
      const avgW = w.reduce((t, p) => t + p.durationMin, 0) / w.length;
      const avgL = l.reduce((t, p) => t + p.durationMin, 0) / l.length;
      if (avgW > 0) {
        value = avgL / avgW;
        score2 = Math.round(Math.min(100, 100 / Math.max(value, 1e-4)));
        offenders = l.filter((p) => p.durationMin > avgW);
      }
    }
    metrics.push({ id: "hold_losers", name: "G\u1ED3ng l\u1ED7", unit: "x", sample: w.length + l.length, sampleUnit: "l\u1EC7nh", value, score: score2, offenders });
  }
  const withMfe = rows.filter((p) => p.mfeR !== null && p.grossR !== null);
  {
    const offenders = withMfe.filter((p) => p.mfeR - p.grossR >= s.greedGapR);
    metrics.push({ id: "greed", name: "H\u1EE5t \u0103n", unit: "%", sample: withMfe.length, sampleUnit: "l\u1EC7nh", value: rate(offenders.length, withMfe.length), score: rateScore(offenders.length, withMfe.length), offenders });
  }
  {
    const winners = withMfe.filter((p) => p.net > 0);
    const offenders = winners.filter((p) => p.grossR < s.earlyExitMaxR && p.mfeR >= s.earlyExitMfeR);
    metrics.push({ id: "early_exit", name: "C\u1EAFt non", unit: "%", sample: winners.length, sampleUnit: "l\u1EC7nh", value: rate(offenders.length, winners.length), score: rateScore(offenders.length, winners.length), offenders });
  }
  {
    const active = plansCount > 0 && total > 0;
    const offenders = active ? rows.filter((p) => !p.planId) : [];
    metrics.push({
      id: "no_plan",
      name: "V\xE0o l\u1EC7nh ngo\xE0i plan",
      unit: "%",
      sample: active ? total : 0,
      sampleUnit: "l\u1EC7nh",
      value: active ? rate(offenders.length, total) : null,
      score: active ? rateScore(offenders.length, total) : null,
      offenders,
      note: active ? void 0 : "Ch\u01B0a c\xF3 plan n\xE0o"
    });
  }
  metrics.forEach((m) => {
    if (m.score !== null && m.sample < MIN_SAMPLE) {
      m.excluded = true;
      m.note = `M\u1EABu nh\u1ECF (${m.sample} ${m.sampleUnit}), kh\xF4ng t\xEDnh \u0111i\u1EC3m t\u1ED5ng`;
    }
  });
  const scored = metrics.filter((m) => m.score !== null && !m.excluded);
  const score = scored.length ? Math.round(scored.reduce((t, m) => t + m.score, 0) / scored.length) : null;
  return { metrics, score, level: psyLevel(score) };
}
var EMPTY_PROP_RULES = { dailyLossPct: null, maxDdPct: null, targetPct: null, minDays: null, consistencyPct: null };
function computePropStatus(all, initialBalance, now = /* @__PURE__ */ new Date()) {
  const sorted = [...all].sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
  const dayNet = /* @__PURE__ */ new Map();
  let balance = initialBalance;
  let lowest = initialBalance;
  sorted.forEach((p) => {
    balance += p.net;
    lowest = Math.min(lowest, balance);
    const k = dayKey(p.closeTime);
    dayNet.set(k, (dayNet.get(k) || 0) + p.net);
  });
  const days = Array.from(dayNet.values());
  const bestDay = days.length ? Math.max(...days) : 0;
  const totalProfit = balance - initialBalance;
  return {
    balance,
    lowestBalance: lowest,
    todayNet: dayNet.get(dayKey(now)) || 0,
    worstDay: days.length ? Math.min(...days) : 0,
    bestDay,
    tradingDays: dayNet.size,
    totalProfit,
    bestDaySharePct: totalProfit > 0 && bestDay > 0 ? bestDay / totalProfit * 100 : null
  };
}

// src/utils/reportMessage.ts
var esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var pct = (v) => `${v.toFixed(1)}%`;
function deltaText(cur, prev, fmt2) {
  if (cur === null || prev === null) return "";
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return " (= k\u1EF3 tr\u01B0\u1EDBc)";
  return ` (${d > 0 ? "\u25B2" : "\u25BC"} ${fmt2(Math.abs(d))} so v\u1EDBi k\u1EF3 tr\u01B0\u1EDBc)`;
}
var KIND_LABEL = { WEEK: "TU\u1EA6N", MONTH: "TH\xC1NG", QUARTER: "QU\xDD" };
function buildPeriodReport(i) {
  const range = getPeriodRange(i.kind, -1, i.now);
  const prevRange = getPeriodRange(i.kind, -2, i.now);
  const inR = (p, r) => p.closeTime >= r.start && p.closeTime < r.end;
  const list = i.all.filter((p) => inR(p, range));
  const prevList = i.all.filter((p) => inR(p, prevRange));
  if (!list.length) return null;
  const s = summarize(list);
  const ps = prevList.length ? summarize(prevList) : null;
  const psy = computePsychology(list, i.psy, i.plansCount);
  const psyPrev = prevList.length ? computePsychology(prevList, i.psy, i.plansCount) : null;
  const startBal = i.initialBalance + i.all.filter((p) => p.closeTime < range.start).reduce((t, p) => t + p.net, 0);
  const eq = equityCurve(list, startBal);
  const lines = [];
  lines.push(`<b>B\xC1O C\xC1O ${KIND_LABEL[i.kind]} \xB7 ${esc(range.label)}</b>`);
  lines.push(esc(i.accountLabel));
  lines.push("");
  lines.push(`PnL: <b>${fmtMoney(s.net)}</b>${deltaText(s.net, ps?.net ?? null, (v) => `$${v.toFixed(2)}`)}`);
  lines.push(`L\u1EC7nh: ${s.count} \xB7 Th\u1EAFng ${s.wins} \xB7 Thua ${s.losses} \xB7 Win Rate ${pct(s.winRate)}${deltaText(s.winRate, ps ? ps.winRate : null, pct)}`);
  lines.push(`Profit Factor: ${s.profitFactor === null ? "\u2014" : s.profitFactor.toFixed(2)} \xB7 R TB: ${fmtR(s.avgR)} \xB7 T\u1ED5ng R: ${s.rCount ? fmtR(s.totalR) : "\u2014"}`);
  lines.push(`S\u1EE5t gi\u1EA3m l\u1EDBn nh\u1EA5t: -$${eq.maxDrawdown.toFixed(2)} \xB7 Chu\u1ED7i thua d\xE0i nh\u1EA5t: ${s.maxLossStreak}`);
  lines.push("");
  lines.push(`<b>\u0110i\u1EC3m T\xE2m L\xFD: ${psy.score ?? "\u2014"} (${psy.level})</b>${deltaText(psy.score, psyPrev?.score ?? null, (v) => `${v} \u0111i\u1EC3m`)}`);
  const bad = psy.metrics.filter((m) => !m.excluded && m.score !== null && m.score < 80 && m.offenders.length).sort((a, b) => a.score - b.score).slice(0, 4);
  bad.forEach((m) => {
    const v = m.value === null ? "" : m.unit === "%" ? pct(m.value) : `${m.value.toFixed(2)}x`;
    lines.push(`\u2022 ${m.name}: ${v} (${m.offenders.length} l\u1EC7nh)${m.note ? ` \xB7 ${esc(m.note)}` : ""}`);
  });
  if (!bad.length) lines.push("\u2022 Kh\xF4ng c\xF3 ch\u1EC9 s\u1ED1 t\xE2m l\xFD n\xE0o d\u01B0\u1EDBi 80");
  const st = computePropStatus(i.all, i.initialBalance, i.now);
  if (i.prop.maxDdPct !== null || i.prop.targetPct !== null) {
    lines.push("");
    lines.push("<b>Lu\u1EADt qu\u1EF9</b>");
    if (i.prop.maxDdPct !== null) {
      const floor = i.initialBalance * (1 - i.prop.maxDdPct / 100);
      lines.push(`S\u1ED1 d\u01B0 $${st.balance.toFixed(2)} \xB7 c\xE1ch \u0111\xE1y cho ph\xE9p $${(st.balance - floor).toFixed(2)}`);
    }
    if (i.prop.targetPct !== null && i.initialBalance > 0) {
      lines.push(`L\u1EE3i nhu\u1EADn ${pct(st.totalProfit / i.initialBalance * 100)} / m\u1EE5c ti\xEAu ${i.prop.targetPct}%`);
    }
  }
  return lines.join("\n");
}
var sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
function buildAlerts(i) {
  const out = [];
  const sorted = [...i.all].sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
  if (i.event === "OPEN") {
    const openAt = toDisplayDate(i.trade.open_time, i.offsetHours);
    if (!openAt) return out;
    const before = sorted.filter((p) => p.closeTime.getTime() <= openAt.getTime());
    const last = before[before.length - 1];
    if (last && last.net < 0) {
      const mins = (openAt.getTime() - last.closeTime.getTime()) / 6e4;
      if (mins <= i.psy.revengeMinutes) {
        out.push(`<b>C\u1EA3nh b\xE1o tr\u1EA3 th\xF9</b>: v\xE0o ${esc(i.trade.symbol)} ${i.trade.type} ${i.trade.volume}L ch\u1EC9 ${Math.round(mins)} ph\xFAt sau l\u1EC7nh thua ${fmtMoney(last.net)}`);
      }
      if (i.trade.volume > last.volume) {
        out.push(`<b>T\u0103ng lot sau thua</b>: ${i.trade.volume}L l\u1EDBn h\u01A1n l\u1EC7nh v\u1EEBa thua ${last.volume}L`);
      }
    }
    const today = before.filter((p) => sameDay(p.closeTime, openAt));
    const n = i.all.filter((p) => sameDay(p.openTime, openAt)).length + 1;
    if (n > i.psy.maxTradesPerDay) out.push(`<b>\u0110\xE1nh qu\xE1 tay</b>: \u0111\xE2y l\xE0 l\u1EC7nh th\u1EE9 ${n} h\xF4m nay (gi\u1EDBi h\u1EA1n ${i.psy.maxTradesPerDay})`);
    if (today.length >= 2 && today[today.length - 1].net < 0 && today[today.length - 2].net < 0) {
      out.push("<b>\u0110\xE3 thua 2 l\u1EC7nh li\u1EC1n h\xF4m nay</b> m\xE0 v\u1EABn v\xE0o l\u1EC7nh ti\u1EBFp");
    }
  } else {
    const key = String(i.trade.position_id || i.trade.ticket);
    const p = sorted.find((x) => x.id.endsWith(`|${key}`) || x.ticket === String(i.trade.ticket));
    if (!p) return out;
    if (p.risk > 0 && -p.gross > p.risk * (1 + i.psy.slTolerancePct / 100)) {
      out.push(`<b>L\u1ED7 v\u01B0\u1EE3t 1R</b>: ${esc(p.symbol)} l\u1ED7 ${fmtMoney(p.net)} = ${fmtR(p.r)} (SL b\u1ECB d\u1EDDi / kh\xF4ng t\xF4n tr\u1ECDng?)`);
    }
    const today = sorted.filter((x) => sameDay(x.closeTime, p.closeTime));
    if (today.length >= 2 && today[today.length - 1].net < 0 && today[today.length - 2].net < 0) {
      out.push(`<b>Thua 2 l\u1EC7nh li\u1EC1n h\xF4m nay</b> (t\u1ED5ng ${fmtMoney(today[today.length - 1].net + today[today.length - 2].net)}). N\xEAn d\u1EEBng l\u1EA1i.`);
    }
    if (i.prop.dailyLossPct !== null && i.initialBalance > 0) {
      const limit = i.initialBalance * i.prop.dailyLossPct / 100;
      const dayNet = today.reduce((t, x) => t + x.net, 0);
      if (-dayNet >= limit * 0.7) {
        out.push(`<b>G\u1EA7n ch\u1EA1m l\u1ED7 t\u1ED1i \u0111a ng\xE0y</b>: h\xF4m nay ${fmtMoney(dayNet)} / gi\u1EDBi h\u1EA1n -$${limit.toFixed(2)} \xB7 c\xF2n $${Math.max(0, limit + dayNet).toFixed(2)}`);
      }
    }
  }
  if (out.length) out.unshift(esc(i.accountLabel));
  return out;
}

// supabase/functions/notify/index.ts
var env = (k) => Deno.env.get(k) || "";
var db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
var ADMIN_EMAILS = ["ltf.tlht@gmail.com"];
var LIGHT = "account_id,ticket,position_id,symbol,type,volume,open_price,close_price,pnl,commission,swap,initial_balance,status,open_time,close_time,initial_sl,plan_id,timeframe,setup,checklist,mistake_tags,mae_price,mfe_price";
var json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
async function sharedSecret() {
  const { data } = await db.from("app_secrets").select("value").eq("name", "notify").maybeSingle();
  return data?.value || "";
}
async function sendTelegram(chatId, html) {
  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token || !chatId) return false;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true })
  });
  return r.ok;
}
async function sendEmail(to, subject, html) {
  const key = env("RESEND_API_KEY");
  if (!key || !to) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from: env("EMAIL_FROM") || "BIG-DEAL <onboarding@resend.dev>", to, subject, html: html.replace(/\n/g, "<br>") })
  });
  return r.ok;
}
async function deliver(n, subject, html, viaEmail) {
  const tg = n.telegram_chat_id ? await sendTelegram(n.telegram_chat_id, html) : false;
  const em = viaEmail && n.email ? await sendEmail(n.email, subject, html) : false;
  return tg || em;
}
async function userContext(userId) {
  const [{ data: s }, { data: u }] = await Promise.all([
    db.from("user_settings").select("data").eq("user_id", userId).maybeSingle(),
    db.auth.admin.getUserById(userId)
  ]);
  const data = s?.data || {};
  const parse = (k, d) => {
    try {
      return data[k] ? JSON.parse(data[k]) : d;
    } catch {
      return d;
    }
  };
  const email = (u?.user?.email || "").toLowerCase();
  return {
    email,
    isAdmin: ADMIN_EMAILS.includes(email),
    offset: Number(data["trade_journal_timezone_offset"] ?? 4) || 0,
    psy: { ...DEFAULT_PSY_SETTINGS, ...parse("bd_psychology_settings", {}) },
    prop: (acc) => ({ ...EMPTY_PROP_RULES, ...parse(`bd_prop_rules_${acc}`, {}) }),
    accountsList: parse("deal_accounts_list", [])
  };
}
async function accountsOf(ctx) {
  if (ctx.isAdmin) {
    const { data: data2 } = await db.from("trades").select("account_id");
    return Array.from(new Set((data2 || []).map((r) => String(r.account_id)).filter(Boolean)));
  }
  const { data } = await db.from("licenses").select("allowed_accounts,status,expires_at").eq("email", ctx.email).maybeSingle();
  const l = data;
  if (!l || l.status !== "ACTIVE" || l.expires_at && new Date(l.expires_at) < /* @__PURE__ */ new Date()) return [];
  return String(l.allowed_accounts || "").split(",").map((s) => s.trim().replace(/^acc-/, "")).filter(Boolean);
}
async function positionsOf(acc, ctx) {
  const { data } = await db.from("trades").select(LIGHT).eq("account_id", acc).eq("status", "CLOSED");
  const rows = data || [];
  const listed = ctx.accountsList.find((a) => String(a.id).replace(/^acc-/, "") === acc);
  const init = Number(rows.find((r) => Number(r.initial_balance) > 0)?.initial_balance) || Number(listed?.initial_balance) || 0;
  const mapped = rows.map((r) => ({ ...r, pre_checklist_ids: r.checklist, post_checklist_ids: r.mistake_tags }));
  const trades = processSupabaseTrades(mapped, init, 100, void 0, ctx.offset);
  const name = String(listed?.name || "");
  const label = name && !name.includes(acc) ? `${name} (#${acc})` : name || `MT5 #${acc}`;
  return { positions: buildPositions(trades, ctx.offset, false), init, label };
}
var nowDisplay = () => new Date(Date.now() + 7 * 3600 * 1e3 + (/* @__PURE__ */ new Date()).getTimezoneOffset() * 6e4);
async function runPeriodReports(kind) {
  const col = { WEEK: "weekly", MONTH: "monthly", QUARTER: "quarterly" }[kind];
  const { data: subs } = await db.from("notify_settings").select("*").eq(col, true);
  let sent = 0;
  for (const n of subs || []) {
    const ctx = await userContext(n.user_id);
    for (const acc of await accountsOf(ctx)) {
      const { positions, init, label } = await positionsOf(acc, ctx);
      const now = nowDisplay();
      const { count: plansCount } = await db.from("plans").select("id", { count: "exact", head: true }).eq("account_id", acc);
      const msg = buildPeriodReport({ accountLabel: label, all: positions, kind, now, psy: ctx.psy, prop: ctx.prop(acc), initialBalance: init, plansCount: plansCount || 0 });
      if (!msg) continue;
      const key = `${kind}|${acc}|${now.toISOString().slice(0, 10)}`;
      const { error: dup } = await db.from("notify_log").insert({ user_id: n.user_id, key });
      if (dup) continue;
      if (await deliver(n, `BIG-DEAL \xB7 B\xE1o c\xE1o ${col}`, msg, true)) sent++;
    }
  }
  return sent;
}
async function runTradeEvent(rec) {
  const status = String(rec?.status || "").toUpperCase();
  const event = status === "OPEN" ? "OPEN" : status === "CLOSED" ? "CLOSED" : null;
  if (!event) return 0;
  const acc = String(rec.account_id || "");
  const { data: subs } = await db.from("notify_settings").select("*").eq("alerts", true);
  const eventKey = event === "CLOSED" ? String(rec.position_id || rec.ticket) : String(rec.ticket);
  let sent = 0;
  for (const n of subs || []) {
    const ctx = await userContext(n.user_id);
    if (!(await accountsOf(ctx)).includes(acc)) continue;
    const evIso = String((event === "CLOSED" ? rec.close_time : rec.open_time) || "").trim().replace(/[./]/g, "-").replace(" ", "T") + "Z";
    const evAt = new Date(new Date(evIso).getTime() + ctx.offset * 3600 * 1e3);
    const nowVn = new Date(Date.now() + 7 * 3600 * 1e3);
    if (isNaN(evAt.getTime()) || Math.abs(nowVn.getTime() - evAt.getTime()) > 3 * 3600 * 1e3) continue;
    const { error: dup } = await db.from("notify_log").insert({ user_id: n.user_id, key: `alert|${acc}|${eventKey}|${event}` });
    if (dup) continue;
    const { positions, init, label } = await positionsOf(acc, ctx);
    const alerts = buildAlerts({ accountLabel: label, all: positions, event, trade: rec, offsetHours: ctx.offset, psy: ctx.psy, prop: ctx.prop(acc), initialBalance: init });
    if (alerts.length && await deliver(n, "BIG-DEAL \xB7 C\u1EA3nh b\xE1o", alerts.join("\n"), false)) sent++;
  }
  return sent;
}
async function telegramUpdate(update) {
  const msg = update?.message;
  const text = String(msg?.text || "");
  const chatId = String(msg?.chat?.id || "");
  const m = text.match(/^\/start\s+([A-Za-z0-9_-]{16,})/);
  if (!m || !chatId) {
    if (chatId) await sendTelegram(chatId, "M\u1EDF app BIG-DEAL, v\xE0o C\xE0i \u0111\u1EB7t v\xE0 b\u1EA5m <b>K\u1EBFt n\u1ED1i Telegram</b> \u0111\u1EC3 nh\u1EADn b\xE1o c\xE1o.");
    return;
  }
  const { data: row } = await db.from("notify_settings").select("user_id").eq("link_code", m[1]).maybeSingle();
  if (!row) {
    await sendTelegram(chatId, "M\xE3 k\u1EBFt n\u1ED1i kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c \u0111\xE3 d\xF9ng. B\u1EA5m l\u1EA1i n\xFAt K\u1EBFt n\u1ED1i Telegram trong app.");
    return;
  }
  await db.from("notify_settings").update({ telegram_chat_id: chatId, link_code: null }).eq("user_id", row.user_id);
  await sendTelegram(chatId, "\u0110\xE3 k\u1EBFt n\u1ED1i BIG-DEAL. Th\u1EA7y s\u1EBD nh\u1EADn b\xE1o c\xE1o tu\u1EA7n / th\xE1ng / qu\xFD v\xE0 c\u1EA3nh b\xE1o t\xE2m l\xFD t\u1EA1i \u0111\xE2y.");
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  const secret = await sharedSecret();
  if (req.headers.get("x-telegram-bot-api-secret-token")) {
    if (req.headers.get("x-telegram-bot-api-secret-token") !== secret) return json({ error: "forbidden" }, 403);
    await telegramUpdate(await req.json());
    return json({ ok: true });
  }
  const body = await req.json().catch(() => ({}));
  if (req.headers.get("x-bd-secret")) {
    if (!secret || req.headers.get("x-bd-secret") !== secret) return json({ error: "forbidden" }, 403);
    if (body.action === "report") return json({ sent: await runPeriodReports(body.kind) });
    if (body.action === "trade_event") return json({ sent: await runTradeEvent(body.record) });
    return json({ error: "unknown action" }, 400);
  }
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return json({ error: "unauthorized" }, 401);
  await db.from("notify_settings").upsert({ user_id: user.id, email: user.email }, { onConflict: "user_id", ignoreDuplicates: true });
  if (body.action === "link_telegram") {
    const token = env("TELEGRAM_BOT_TOKEN");
    if (!token) return json({ error: "Ch\u01B0a \u0111\u1EB7t TELEGRAM_BOT_TOKEN tr\xEAn Supabase" }, 400);
    const self = `${env("SUPABASE_URL")}/functions/v1/notify`;
    await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: self, secret_token: secret, allowed_updates: ["message"] })
    });
    const me = await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).json();
    const code = crypto.randomUUID().replace(/-/g, "");
    await db.from("notify_settings").update({ link_code: code }).eq("user_id", user.id);
    return json({ url: `https://t.me/${me?.result?.username}?start=${code}` });
  }
  if (body.action === "test") {
    const { data: n } = await db.from("notify_settings").select("*").eq("user_id", user.id).single();
    const ok = await deliver(n, "BIG-DEAL \xB7 Th\u1EED th\xF4ng b\xE1o", "<b>BIG-DEAL</b>\nTh\xF4ng b\xE1o th\u1EED: k\u1EBFt n\u1ED1i ho\u1EA1t \u0111\u1ED9ng.", true);
    return json({ ok });
  }
  return json({ error: "unknown action" }, 400);
});
