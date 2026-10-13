import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  createChart, 
  CandlestickSeries, 
  ColorType, 
  CrosshairMode,
  IChartApi, 
  ISeriesApi,
  createSeriesMarkers,
  LineStyle
} from 'lightweight-charts';
import { TradeRow, AccountInfo } from '../types';
import { fetchRealMarketCandles } from '../utils/realCandleFeed';
import { 
  RotateCw,
  LineChart,
  Flag,
  Palette,
  MousePointer,
  TrendingUp,
  Minus,
  Square,
  Ruler,
  Type,
  Undo2,
  Trash2
} from 'lucide-react';

interface ChartTabProps {
  trades: TradeRow[];
  activeAccount: AccountInfo;
  selectedTradeId?: string | null;
  onSelectTrade?: (trade: TradeRow) => void;
  timezoneOffset?: number;
}

interface CandleTheme {
  id: string;
  name: string;
  up: string;
  down: string;
}

type DrawingToolType = 'CURSOR' | 'TRENDLINE' | 'HORIZONTAL' | 'RECTANGLE' | 'MEASURE' | 'TEXT';

interface ChartDrawingPoint {
  time: number;
  price: number;
}

interface ChartDrawing {
  id: string;
  type: DrawingToolType;
  p1: ChartDrawingPoint;
  p2?: ChartDrawingPoint;
  text?: string;
  color?: string;
}

const CANDLE_THEMES: CandleTheme[] = [
  { id: 'sage-clay', name: 'Sage / Clay (Màu Kem)', up: '#4a6152', down: '#825249' },
  { id: 'emerald-rose', name: 'Emerald / Rose', up: '#10b981', down: '#f43f5e' },
  { id: 'green-red', name: 'Green / Red (MT5)', up: '#22c55e', down: '#ef4444' },
  { id: 'monochrome', name: 'Tối Giản', up: '#334155', down: '#94a3b8' },
];

const POPULAR_SYMBOLS = [
  { group: 'Kim Loại', items: ['XAUUSD'] },
  { group: 'Ngoại Hối (Forex)', items: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD'] },
  { group: 'Tiền Mã Hóa (Crypto)', items: ['BTCUSD', 'ETHUSD', 'SOLUSD'] },
  { group: 'Chỉ Số (Indices)', items: ['US30', 'NAS100', 'US500'] },
];

/**
 * Component nhúng TradingView Advanced Chart chính hãng:
 * - Dùng script chính thức của TradingView (không bao giờ bị lỗi 403)
 * - Tự động lưu bản vẽ của người dùng vào trình duyệt
 * - Không tự ý sinh ra indicator thừa (EMA/RSI), xóa là mất vĩnh viễn
 * - Kéo thả (Pan/Zoom) mượt mà 100%
 */
const TradingViewProWidget: React.FC<{ symbol: string }> = ({ symbol }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentSymbolRef = useRef<string>('');

  useEffect(() => {
    if (!containerRef.current) return;
    if (currentSymbolRef.current === symbol && containerRef.current.children.length > 0) {
      return;
    }

    currentSymbolRef.current = symbol;
    containerRef.current.innerHTML = '';

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.width = '100%';
    widgetContainer.style.height = '100%';

    const widgetInner = document.createElement('div');
    widgetInner.className = 'tradingview-widget-container__widget';
    widgetInner.style.width = '100%';
    widgetInner.style.height = '100%';

    widgetContainer.appendChild(widgetInner);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: "15",
      timezone: "Asia/Ho_Chi_Minh",
      theme: "light",
      style: "1",
      locale: "vi",
      enable_publishing: false,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      save_image: true,
      calendar: false,
      support_host: "https://www.tradingview.com"
    });

    widgetContainer.appendChild(script);
    containerRef.current.appendChild(widgetContainer);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative" 
      style={{ width: '100%', height: '100%' }} 
    />
  );
};

export const ChartTab: React.FC<ChartTabProps> = ({
  trades = [],
  selectedTradeId,
  onSelectTrade,
  timezoneOffset = 4,
}) => {
  // Chế độ biểu đồ: 'tradingview' hoặc 'execution' (Đồng bộ với Sidebar và LocalStorage)
  const [chartMode, setChartMode] = useState<'tradingview' | 'execution'>(() => {
    try {
      const saved = localStorage.getItem('deal_active_chart_mode');
      if (saved === 'tradingview' || saved === 'execution') return saved;
    } catch {}
    return 'tradingview';
  });

  const handleSetChartMode = useCallback((newMode: 'tradingview' | 'execution') => {
    setChartMode(newMode);
    try {
      localStorage.setItem('deal_active_chart_mode', newMode);
    } catch {}
  }, []);

  // Lắng nghe sự kiện chuyển đổi chế độ biểu đồ từ Sidebar menu con
  useEffect(() => {
    const handleModeEvent = (e: any) => {
      const targetMode = e?.detail;
      if (targetMode === 'tradingview' || targetMode === 'execution') {
        handleSetChartMode(targetMode);
      }
    };
    window.addEventListener('deal_chart_mode_changed', handleModeEvent);
    return () => {
      window.removeEventListener('deal_chart_mode_changed', handleModeEvent);
    };
  }, [handleSetChartMode]);

  // Sắp xếp danh sách lệnh mới nhất lên đầu
  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      const timeA = new Date(a.close_time || a.open_time || 0).getTime();
      const timeB = new Date(b.close_time || b.open_time || 0).getTime();
      return timeB - timeA;
    });
  }, [trades]);

  // Danh sách lệnh hiển thị ở cột bên phải
  const filteredTrades = useMemo(() => {
    return sortedTrades;
  }, [sortedTrades]);

  // Danh sách các Symbol có trong tài khoản
  const uniqueAccountSymbols = useMemo(() => {
    return Array.from(new Set(trades.map(t => (t.symbol || '').toUpperCase().trim()).filter(Boolean)));
  }, [trades]);

  // Cặp tiền đang chọn xem biểu đồ (mặc định theo lệnh đầu tiên hoặc XAUUSD)
  const [selectedSymbol, setSelectedSymbol] = useState<string>(() => {
    if (selectedTradeId) {
      const found = trades.find(t => String(t.id) === String(selectedTradeId) || String(t.ticket) === String(selectedTradeId));
      if (found?.symbol) return found.symbol.toUpperCase().trim();
    }
    return sortedTrades[0]?.symbol?.toUpperCase().trim() || 'XAUUSD';
  });

  // Lệnh đang được chọn để cắm cờ
  const [activeTrade, setActiveTrade] = useState<TradeRow | null>(() => {
    if (selectedTradeId) {
      const found = trades.find(t => String(t.id) === String(selectedTradeId) || String(t.ticket) === String(selectedTradeId));
      if (found) return found;
    }
    return sortedTrades[0] || null;
  });

  useEffect(() => {
    if (selectedTradeId) {
      const found = trades.find(t => String(t.id) === String(selectedTradeId) || String(t.ticket) === String(selectedTradeId));
      if (found) {
        setActiveTrade(found);
        if (found.symbol) setSelectedSymbol(found.symbol.toUpperCase().trim());
      }
    }
  }, [selectedTradeId, trades]);

  // Khung thời gian cho chế độ cắm cờ MT5
  const [timeframeMinutes, setTimeframeMinutes] = useState<number>(15);
  const [isLoadingCandles, setIsLoadingCandles] = useState<boolean>(false);

  // Theme màu nến cho chế độ cắm cờ MT5
  const [candleThemeId, setCandleThemeId] = useState<string>(() => {
    return localStorage.getItem('trade_chart_candle_theme') || 'sage-clay';
  });

  const currentTheme = useMemo(() => {
    return CANDLE_THEMES.find(t => t.id === candleThemeId) || CANDLE_THEMES[0];
  }, [candleThemeId]);

  // Refs cho Lightweight Charts
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const canvasOverlayRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const seriesInstanceRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const markersPrimitiveRef = useRef<any>(null);

  // HỆ THỐNG CÔNG CỤ VẼ TAY TRÊN LIGHTWEIGHT CHARTS (BÁM NẾN, KHÔNG BỊ TRÔI)
  const [activeTool, setActiveTool] = useState<DrawingToolType>('CURSOR');
  const [drawings, setDrawings] = useState<ChartDrawing[]>(() => {
    try {
      const saved = localStorage.getItem('trade_chart_custom_drawings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const draftDrawingRef = useRef<{ p1: ChartDrawingPoint; p2?: ChartDrawingPoint } | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Lưu ref ổn định để vẽ không gây re-render / hủy biểu đồ
  const drawingsRef = useRef<ChartDrawing[]>(drawings);
  useEffect(() => {
    drawingsRef.current = drawings;
  }, [drawings]);

  const activeToolRef = useRef<DrawingToolType>(activeTool);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // Lưu bản vẽ tự động vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem('trade_chart_custom_drawings', JSON.stringify(drawings));
    } catch {}
  }, [drawings]);

  // Múi giờ bù giờ (+4h theo thiết lập trên App của Thầy)
  const effectiveOffset = timezoneOffset !== undefined ? timezoneOffset : 4;

  // Format giờ lệnh MT5 sau khi đã bù +4h
  const formatTradeTime = useCallback((dateStr?: string) => {
    if (!dateStr) return '–';
    try {
      const m = dateStr.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
      if (m) {
        const y = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10) - 1;
        const d = parseInt(m[3], 10);
        const h = parseInt(m[4], 10) + effectiveOffset;
        const min = parseInt(m[5], 10);
        const targetDate = new Date(Date.UTC(y, mo, d, h, min));
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(targetDate.getUTCDate())}/${pad(targetDate.getUTCMonth() + 1)}/${targetDate.getUTCFullYear()} ${pad(targetDate.getUTCHours())}:${pad(targetDate.getUTCMinutes())}`;
      }
      return dateStr.slice(0, 16);
    } catch {
      return dateStr.slice(0, 16);
    }
  }, [effectiveOffset]);

  // Parse thời gian lệnh sang Unix Seconds đã bù giờ hiển thị (+4h)
  const parseTradeTimeToDisplayUnixSec = useCallback((dateStr?: string): number => {
    if (!dateStr) return 0;
    try {
      const m = dateStr.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
      if (m) {
        const y = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10) - 1;
        const d = parseInt(m[3], 10);
        const h = parseInt(m[4], 10) + effectiveOffset;
        const min = parseInt(m[5], 10);
        const sec = m[6] ? parseInt(m[6], 10) : 0;
        return Math.floor(Date.UTC(y, mo, d, h, min, sec) / 1000);
      }
      const d = new Date(dateStr.replace(/-/g, '/'));
      if (isNaN(d.getTime())) return 0;
      return Math.floor(d.getTime() / 1000) + effectiveOffset * 3600;
    } catch {
      return 0;
    }
  }, [effectiveOffset]);

  // Ánh xạ Symbol sang Ticker chuẩn của TradingView
  const getTradingViewSymbol = useCallback((rawSymbol?: string) => {
    const cleanSym = (rawSymbol || 'XAUUSD').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanSym.includes('XAU') || cleanSym.includes('GOLD')) return 'OANDA:XAUUSD';
    if (cleanSym.includes('BTC')) return 'BINANCE:BTCUSDT';
    if (cleanSym.includes('ETH')) return 'BINANCE:ETHUSDT';
    if (cleanSym.includes('SOL')) return 'BINANCE:SOLUSDT';
    if (cleanSym.includes('EURUSD')) return 'FX:EURUSD';
    if (cleanSym.includes('GBPUSD')) return 'FX:GBPUSD';
    if (cleanSym.includes('USDJPY')) return 'FX:USDJPY';
    if (cleanSym.includes('AUDUSD')) return 'FX:AUDUSD';
    if (cleanSym.includes('USDCAD')) return 'FX:USDCAD';
    if (cleanSym.includes('USDCHF')) return 'FX:USDCHF';
    if (cleanSym.includes('NZDUSD')) return 'FX:NZDUSD';
    if (cleanSym.includes('US30') || cleanSym.includes('DJI')) return 'DJ:DJI';
    if (cleanSym.includes('NAS') || cleanSym.includes('US100')) return 'NASDAQ:NDX';
    if (cleanSym.includes('SPX') || cleanSym.includes('US500')) return 'S&P:SPX';
    return `FX:${cleanSym}`;
  }, []);

  // Xử lý khi người dùng chọn Symbol từ Dropdown
  const handleSymbolChange = (newSymbol: string) => {
    setSelectedSymbol(newSymbol);
    const matchingTrade = sortedTrades.find(t => (t.symbol || '').toUpperCase().trim() === newSymbol.toUpperCase().trim());
    if (matchingTrade) {
      setActiveTrade(matchingTrade);
      if (onSelectTrade) onSelectTrade(matchingTrade);
    }
  };

  // VẼ LẠI TOÀN BỘ CÁC NÉT VẼ DỰA TRÊN TỌA ĐỘ NẾN VÀ GIÁ (KHÔNG BỊ TRÔI KHI KÉO/ZOOM)
  const redrawShapes = useCallback(() => {
    if (!canvasOverlayRef.current || !chartInstanceRef.current || !seriesInstanceRef.current) return;
    const canvas = canvasOverlayRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const timeScale = chartInstanceRef.current.timeScale();
    const series = seriesInstanceRef.current;
    const curDrawings = drawingsRef.current;
    const curTool = activeToolRef.current;

    // Vẽ từng hình vẽ đã lưu
    curDrawings.forEach((d) => {
      const x1 = timeScale.timeToCoordinate(d.p1.time as any);
      const y1 = series.priceToCoordinate(d.p1.price);
      if (x1 == null || y1 == null) return;

      const mainColor = d.color || '#4a6152';

      if (d.type === 'HORIZONTAL') {
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y1);
        ctx.lineTo(canvas.width, y1);
        ctx.stroke();
        ctx.setLineDash([]);

        // Vẽ nhãn giá ở mép phải
        ctx.fillStyle = mainColor;
        ctx.font = 'bold 10px monospace';
        ctx.fillText(d.p1.price.toFixed(2), canvas.width - 65, y1 - 4);
      } else if (d.type === 'TRENDLINE' && d.p2) {
        const x2 = timeScale.timeToCoordinate(d.p2.time as any);
        const y2 = series.priceToCoordinate(d.p2.price);
        if (x2 == null || y2 == null) return;

        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      } else if (d.type === 'RECTANGLE' && d.p2) {
        const x2 = timeScale.timeToCoordinate(d.p2.time as any);
        const y2 = series.priceToCoordinate(d.p2.price);
        if (x2 == null || y2 == null) return;

        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        ctx.fillStyle = 'rgba(74, 97, 82, 0.15)';
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 1.5;
        ctx.fillRect(left, top, width, height);
        ctx.strokeRect(left, top, width, height);
      } else if (d.type === 'MEASURE' && d.p2) {
        const x2 = timeScale.timeToCoordinate(d.p2.time as any);
        const y2 = series.priceToCoordinate(d.p2.price);
        if (x2 == null || y2 == null) return;

        const deltaPrice = d.p2.price - d.p1.price;
        const deltaPercent = d.p1.price > 0 ? (deltaPrice / d.p1.price) * 100 : 0;
        const isUp = deltaPrice >= 0;

        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        ctx.fillStyle = isUp ? 'rgba(74, 97, 82, 0.12)' : 'rgba(130, 82, 73, 0.12)';
        ctx.strokeStyle = isUp ? '#4a6152' : '#825249';
        ctx.lineWidth = 1;
        ctx.fillRect(left, top, width, height);
        ctx.strokeRect(left, top, width, height);

        // Nhãn đo khoảng cách
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        ctx.fillStyle = isUp ? '#4a6152' : '#825249';
        ctx.font = 'bold 11px monospace';
        const labelText = `${deltaPrice >= 0 ? '+' : ''}${deltaPrice.toFixed(2)} (${deltaPercent >= 0 ? '+' : ''}${deltaPercent.toFixed(2)}%)`;
        ctx.fillText(labelText, midX - 40, midY);
      } else if (d.type === 'TEXT') {
        ctx.fillStyle = '#1d1b17';
        ctx.font = 'bold 11px sans-serif';
        ctx.beginPath();
        ctx.arc(x1, y1, 3, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillText(d.text || 'Ghi chú', x1 + 6, y1 - 4);
      }
    });

    // Vẽ nét nháp đang kéo dở (Draft Preview)
    if (draftDrawingRef.current && draftDrawingRef.current.p2 && curTool !== 'CURSOR') {
      const d = draftDrawingRef.current;
      const x1 = timeScale.timeToCoordinate(d.p1.time as any);
      const y1 = series.priceToCoordinate(d.p1.price);
      const x2 = timeScale.timeToCoordinate(d.p2.time as any);
      const y2 = series.priceToCoordinate(d.p2.price);

      if (x1 != null && y1 != null && x2 != null && y2 != null) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);

        if (curTool === 'TRENDLINE') {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        } else if (curTool === 'RECTANGLE' || curTool === 'MEASURE') {
          const left = Math.min(x1, x2);
          const top = Math.min(y1, y2);
          const width = Math.abs(x2 - x1);
          const height = Math.abs(y2 - y1);
          ctx.strokeRect(left, top, width, height);
        }
        ctx.setLineDash([]);
      }
    }
  }, []);

  const redrawShapesRef = useRef(redrawShapes);
  useEffect(() => {
    redrawShapesRef.current = redrawShapes;
  }, [redrawShapes]);

  // Cập nhật lại hình vẽ trên Canvas Overlay khi danh sách hình hoặc công cụ đổi (không bao giờ phá hủy biểu đồ nến)
  useEffect(() => {
    redrawShapes();
  }, [drawings, activeTool, redrawShapes]);

  // Cập nhật kích thước canvas overlay trùng khớp với biểu đồ
  const syncCanvasOverlaySize = useCallback(() => {
    if (!canvasOverlayRef.current || !chartContainerRef.current) return;
    const canvas = canvasOverlayRef.current;
    const container = chartContainerRef.current;
    if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }
    redrawShapes();
  }, [redrawShapes]);

  // 1. KHỞI TẠO BIỂU ĐỒ LIGHTWEIGHT CHARTS (CHẾ ĐỘ CẮM CỜ MT5) - CHỈ KHỞI TẠO 1 LẦN KHI VÀO CHẾ ĐỘ
  useEffect(() => {
    if (chartMode !== 'execution' || !chartContainerRef.current) return;

    chartContainerRef.current.innerHTML = '';

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#fff8f0' },
        textColor: '#424843',
        fontSize: 11,
        fontFamily: 'Plus Jakarta Sans, -apple-system, sans-serif',
      },
      grid: {
        vertLines: { color: '#ede7df' },
        horzLines: { color: '#ede7df' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { 
          color: '#737973', 
          width: 1, 
          style: LineStyle.Dashed,
          labelVisible: true 
        },
        horzLine: { 
          color: '#737973', 
          width: 1, 
          style: LineStyle.Dashed,
          labelVisible: true 
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      rightPriceScale: {
        borderColor: '#d8d0c5',
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: '#d8d0c5',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: currentTheme.up,
      downColor: currentTheme.down,
      borderVisible: true,
      borderColor: currentTheme.up,
      borderUpColor: currentTheme.up,
      borderDownColor: currentTheme.down,
      wickVisible: true,
      wickUpColor: currentTheme.up,
      wickDownColor: currentTheme.down,
    });

    chartInstanceRef.current = chart;
    seriesInstanceRef.current = candlestickSeries;

    // Lắng nghe sự kiện kéo / zoom để vẽ lại hình dính chặt theo nến
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      redrawShapesRef.current?.();
    });

    const handleResize = () => {
      if (chartContainerRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
      syncCanvasOverlaySize();
    };

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const entry = entries[0];
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        if (chartInstanceRef.current) {
          chartInstanceRef.current.applyOptions({ width, height });
        }
        syncCanvasOverlaySize();
      }
    });

    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    window.addEventListener('resize', handleResize);
    syncCanvasOverlaySize();

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      chart.remove();
      chartInstanceRef.current = null;
      seriesInstanceRef.current = null;
      markersPrimitiveRef.current = null;
    };
  }, [chartMode, syncCanvasOverlaySize]);

  // Cập nhật màu nến trên Lightweight Charts khi theme thay đổi
  const handleSelectTheme = (themeId: string) => {
    setCandleThemeId(themeId);
    localStorage.setItem('trade_chart_candle_theme', themeId);
    const chosen = CANDLE_THEMES.find(t => t.id === themeId);
    if (chosen && seriesInstanceRef.current) {
      seriesInstanceRef.current.applyOptions({
        upColor: chosen.up,
        downColor: chosen.down,
        borderColor: chosen.up,
        borderUpColor: chosen.up,
        borderDownColor: chosen.down,
        wickUpColor: chosen.up,
        wickDownColor: chosen.down,
      });
    }
  };

  // 2. NẠP NẾN THẬT & CẮM CỜ MŨI TÊN (TUYỆT ĐỐI KHÔNG KẺ ĐƯỜNG ENTRY RỐI MẮT)
  const loadCandlesAndMarkers = useCallback(async () => {
    if (chartMode !== 'execution' || !seriesInstanceRef.current || !chartInstanceRef.current) return;

    setIsLoadingCandles(true);

    try {
      const targetSymbol = selectedSymbol || 'XAUUSD';
      const openSec = activeTrade && (activeTrade.symbol || '').toUpperCase().trim() === targetSymbol.toUpperCase().trim()
        ? parseTradeTimeToDisplayUnixSec(activeTrade.open_time)
        : Math.floor(Date.now() / 1000);

      const realCandles = await fetchRealMarketCandles(
        targetSymbol,
        timeframeMinutes,
        openSec - 7 * 3600,
        effectiveOffset
      );

      if (realCandles.length === 0) {
        setIsLoadingCandles(false);
        return;
      }

      // Đưa nến thị trường về đúng múi giờ hiển thị đồng bộ với lệnh (+4h)
      const candleShiftSec = 7 * 3600;
      const formattedData = realCandles.map((c) => ({
        time: (c.time + candleShiftSec) as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      seriesInstanceRef.current.setData(formattedData);

      // CẮM CỜ MŨI TÊN VÀO NẾN
      const relevantTrade = activeTrade && (activeTrade.symbol || '').toUpperCase().trim() === targetSymbol.toUpperCase().trim()
        ? activeTrade
        : sortedTrades.find(t => (t.symbol || '').toUpperCase().trim() === targetSymbol.toUpperCase().trim());

      const markers: any[] = [];

      if (relevantTrade) {
        const isBuy = relevantTrade.type === 'BUY';
        const volume = relevantTrade.volume || 0.1;
        const entryPrice = Number(relevantTrade.open_price) || 0;
        const exitPrice = Number(relevantTrade.close_price) || 0;
        const pnl = Number(relevantTrade.pnl) || 0;
        const pnlText = pnl >= 0 ? `+${pnl.toFixed(2)}$` : `${pnl.toFixed(2)}$`;

        const tradeOpenSec = parseTradeTimeToDisplayUnixSec(relevantTrade.open_time);
        let closestEntryCandleTime = formattedData[0].time;
        let minEntryDiff = Infinity;

        for (const candle of formattedData) {
          const diff = Math.abs(Number(candle.time) - tradeOpenSec);
          if (diff < minEntryDiff) {
            minEntryDiff = diff;
            closestEntryCandleTime = candle.time;
          }
        }

        markers.push({
          time: closestEntryCandleTime,
          position: isBuy ? 'belowBar' : 'aboveBar',
          color: isBuy ? '#4a6152' : '#825249',
          shape: isBuy ? 'arrowUp' : 'arrowDown',
          text: `BUY ${volume} @ ${entryPrice}`,
          size: 2,
        });

        if (relevantTrade.close_time && relevantTrade.status !== 'OPEN') {
          const tradeCloseSec = parseTradeTimeToDisplayUnixSec(relevantTrade.close_time);
          let closestExitCandleTime = formattedData[formattedData.length - 1].time;
          let minExitDiff = Infinity;

          for (const candle of formattedData) {
            const diff = Math.abs(Number(candle.time) - tradeCloseSec);
            if (diff < minExitDiff) {
              minExitDiff = diff;
              closestExitCandleTime = candle.time;
            }
          }

          markers.push({
            time: closestExitCandleTime,
            position: isBuy ? 'aboveBar' : 'belowBar',
            color: pnl >= 0 ? '#4a6152' : '#825249',
            shape: isBuy ? 'arrowDown' : 'arrowUp',
            text: `EXIT @ ${exitPrice} (${pnlText})`,
            size: 2,
          });
        }
      }

      if (markersPrimitiveRef.current) {
        markersPrimitiveRef.current.setMarkers(markers);
      } else {
        markersPrimitiveRef.current = createSeriesMarkers(seriesInstanceRef.current, markers);
      }

      chartInstanceRef.current.timeScale().fitContent();
      setTimeout(() => {
        redrawShapesRef.current?.();
      }, 100);

    } catch (err) {
      console.warn('Lỗi tải nến và cắm cờ:', err);
    } finally {
      setIsLoadingCandles(false);
    }
  }, [chartMode, selectedSymbol, activeTrade, sortedTrades, timeframeMinutes, effectiveOffset, parseTradeTimeToDisplayUnixSec]);

  useEffect(() => {
    if (chartMode === 'execution') {
      loadCandlesAndMarkers();
    }
  }, [chartMode, loadCandlesAndMarkers]);

  // 3. XỬ LÝ SỰ KIỆN CHUỘT CHO CÁC CÔNG CỤ VẼ
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'CURSOR' || !canvasOverlayRef.current || !chartInstanceRef.current || !seriesInstanceRef.current) return;
    const rect = canvasOverlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const time = chartInstanceRef.current.timeScale().coordinateToTime(x) as number;
    const price = seriesInstanceRef.current.coordinateToPrice(y) as number;
    if (time == null || price == null) return;

    if (activeTool === 'HORIZONTAL') {
      const newD: ChartDrawing = {
        id: `draw-${Date.now()}`,
        type: 'HORIZONTAL',
        p1: { time, price },
      };
      setDrawings((prev) => [...prev, newD]);
      setActiveTool('CURSOR');
      draftDrawingRef.current = null;
    } else if (activeTool === 'TEXT') {
      const text = window.prompt('Nhập ghi chú nến (ví dụ: BOS, CHoCH, Order Block, Entry):', 'BOS');
      if (text && text.trim()) {
        const newD: ChartDrawing = {
          id: `draw-${Date.now()}`,
          type: 'TEXT',
          p1: { time, price },
          text: text.trim(),
        };
        setDrawings((prev) => [...prev, newD]);
      }
      setActiveTool('CURSOR');
      draftDrawingRef.current = null;
    } else {
      draftDrawingRef.current = {
        p1: { time, price },
        p2: { time, price },
      };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'CURSOR' || !draftDrawingRef.current || !canvasOverlayRef.current || !chartInstanceRef.current || !seriesInstanceRef.current) return;
    const rect = canvasOverlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const time = chartInstanceRef.current.timeScale().coordinateToTime(x) as number;
    const price = seriesInstanceRef.current.coordinateToPrice(y) as number;
    if (time == null || price == null) return;

    draftDrawingRef.current.p2 = { time, price };
    if (rafIdRef.current == null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        redrawShapesRef.current?.();
      });
    }
  };

  const handleCanvasMouseUp = () => {
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (activeTool === 'CURSOR' || !draftDrawingRef.current || !draftDrawingRef.current.p2) return;

    const d = draftDrawingRef.current;
    if (activeTool === 'TRENDLINE' || activeTool === 'RECTANGLE' || activeTool === 'MEASURE') {
      const newD: ChartDrawing = {
        id: `draw-${Date.now()}`,
        type: activeTool,
        p1: d.p1,
        p2: d.p2,
      };
      setDrawings((prev) => [...prev, newD]);
    }

    draftDrawingRef.current = null;
    setActiveTool('CURSOR');
  };

  // Hoàn tác nét vẽ gần nhất
  const handleUndoDrawing = () => {
    setDrawings((prev) => prev.slice(0, -1));
  };

  // Xóa toàn bộ nét vẽ
  const handleClearAllDrawings = () => {
    setDrawings([]);
    if (canvasOverlayRef.current) {
      const ctx = canvasOverlayRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasOverlayRef.current.width, canvasOverlayRef.current.height);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-84px)] p-2 space-y-2 w-full font-sans bg-[#fff8f0]">
      
      {/* 1. THANH ĐIỀU KHIỂN TRÊN CÙNG: CHUYỂN CHẾ ĐỘ, BỘ CHỌN SYMBOL, KHUNG GIỜ & MÀU NẾN */}
      <div className="h-11 px-3 bg-white rounded-2xl border border-[#d8d0c5] shadow-[4px_6px_16px_rgba(125,110,95,0.06)] flex items-center justify-between gap-3 shrink-0">
        
        {/* NÚT CHUYỂN CHẾ ĐỘ: TRADINGVIEW PRO vs CẮM CỜ LỆNH MT5 */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-[#ede7df] p-0.5 rounded-xl border border-[#d8d0c5]">
            <button
              type="button"
              onClick={() => handleSetChartMode('tradingview')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMode === 'tradingview'
                  ? 'bg-white text-[#1d1b17] shadow-sm'
                  : 'text-[#737973] hover:text-[#1d1b17]'
              }`}
            >
              <LineChart className="w-3.5 h-3.5 text-[#4a6152]" />
              <span>TradingView Pro</span>
            </button>

            <button
              type="button"
              onClick={() => handleSetChartMode('execution')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMode === 'execution'
                  ? 'bg-white text-[#1d1b17] shadow-sm'
                  : 'text-[#737973] hover:text-[#1d1b17]'
              }`}
            >
              <Flag className="w-3.5 h-3.5 text-[#825249]" />
              <span>Cắm Cờ Lệnh MT5</span>
            </button>
          </div>

          {isLoadingCandles && chartMode === 'execution' && (
            <div className="flex items-center gap-1.5 text-xs text-[#4a6152] font-mono animate-pulse">
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
              <span>Đang tải nến...</span>
            </div>
          )}
        </div>

        {/* CÁC NÚT TÙY CHỌN DÀNH CHO CHẾ ĐỘ CẮM CỜ LỆNH MT5 */}
        {chartMode === 'execution' && (
          <div className="flex items-center gap-2">
            {/* Khung thời gian */}
            <div className="flex items-center bg-[#ede7df] p-0.5 rounded-xl border border-[#d8d0c5]">
              {[
                { label: '1m', val: 1 },
                { label: '5m', val: 5 },
                { label: '15m', val: 15 },
                { label: '1h', val: 60 },
                { label: '4h', val: 240 },
                { label: '1D', val: 1440 },
              ].map((tf) => (
                <button
                  key={tf.label}
                  type="button"
                  onClick={() => setTimeframeMinutes(tf.val)}
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer ${
                    timeframeMinutes === tf.val
                      ? 'bg-white text-[#4a6152] font-bold shadow-xs'
                      : 'text-[#737973] hover:text-[#1d1b17]'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* Bảng màu nến */}
            <div className="flex items-center bg-[#ede7df] p-0.5 rounded-xl border border-[#d8d0c5] gap-1">
              <Palette className="w-3.5 h-3.5 text-[#737973] ml-1" />
              {CANDLE_THEMES.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => handleSelectTheme(th.id)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${
                    candleThemeId === th.id
                      ? 'bg-white text-[#1d1b17] font-bold shadow-xs'
                      : 'text-[#737973] hover:text-[#1d1b17]'
                  }`}
                  title={th.name}
                >
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: th.up }} />
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: th.down }} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. KHÔNG GIAN BIỂU ĐỒ BÊN TRÁI vs DANH SÁCH LỆNH BÊN PHẢI */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2.5 w-full">
        
        {/* KHUNG BIỂU ĐỒ BÊN TRÁI (FULL CHIỀU CAO, NỀN TRẮNG KEM) */}
        <div className="flex-1 min-h-0 h-full rounded-2xl border border-[#d8d0c5] bg-white overflow-hidden shadow-[4px_6px_16px_rgba(125,110,95,0.06)] relative">
          
          {/* CHẾ ĐỘ 1: WIDGET TRADINGVIEW ADVANCED CHÍNH HÃNG (GIỮ SỐNG TRONG DOM ĐỂ KHÔNG MẤT BẢN VẼ) */}
          <div className={`w-full h-full relative bg-[#fff8f0] ${chartMode === 'tradingview' ? 'block' : 'hidden'}`}>
            <TradingViewProWidget symbol={getTradingViewSymbol(selectedSymbol)} />
          </div>

          {/* CHẾ ĐỘ 2: BIỂU ĐỒ NẾN THẬT CẮM CỜ LỆNH MT5 CÓ THANH CÔNG CỤ VẼ GIỐNG TRADINGVIEW */}
          <div className={`w-full h-full relative bg-[#fff8f0] flex flex-row ${chartMode === 'execution' ? 'flex' : 'hidden'}`}>
            
            {/* THANH CÔNG CỤ VẼ DỌC BÊN TRÁI CHUẨN TRADINGVIEW */}
            <div className="w-10 bg-[#ede7df] border-r border-[#d8d0c5] flex flex-col items-center py-2 space-y-1.5 shrink-0 z-20">
              <button
                type="button"
                onClick={() => setActiveTool('CURSOR')}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  activeTool === 'CURSOR' ? 'bg-[#4a6152] text-white shadow-sm' : 'text-[#737973] hover:text-[#1d1b17] hover:bg-white'
                }`}
                title="Con trỏ chuột"
              >
                <MousePointer className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('TRENDLINE')}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  activeTool === 'TRENDLINE' ? 'bg-[#4a6152] text-white shadow-sm' : 'text-[#737973] hover:text-[#1d1b17] hover:bg-white'
                }`}
                title="Đường xu hướng (Trendline)"
              >
                <TrendingUp className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('HORIZONTAL')}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  activeTool === 'HORIZONTAL' ? 'bg-[#4a6152] text-white shadow-sm' : 'text-[#737973] hover:text-[#1d1b17] hover:bg-white'
                }`}
                title="Đường nằm ngang (Horizontal Line)"
              >
                <Minus className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('RECTANGLE')}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  activeTool === 'RECTANGLE' ? 'bg-[#4a6152] text-white shadow-sm' : 'text-[#737973] hover:text-[#1d1b17] hover:bg-white'
                }`}
                title="Vùng Order Block / Khung chữ nhật"
              >
                <Square className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('MEASURE')}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  activeTool === 'MEASURE' ? 'bg-[#4a6152] text-white shadow-sm' : 'text-[#737973] hover:text-[#1d1b17] hover:bg-white'
                }`}
                title="Thước đo khoảng cách (Pips & Giá)"
              >
                <Ruler className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('TEXT')}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  activeTool === 'TEXT' ? 'bg-[#4a6152] text-white shadow-sm' : 'text-[#737973] hover:text-[#1d1b17] hover:bg-white'
                }`}
                title="Ghi chú văn bản (CHoCH, BOS, OB...)"
              >
                <Type className="w-4 h-4" />
              </button>

              <div className="w-6 h-[1px] bg-[#d8d0c5] my-1" />

              <button
                type="button"
                onClick={handleUndoDrawing}
                className="p-2 rounded-xl text-[#737973] hover:text-[#1d1b17] hover:bg-white transition-all cursor-pointer"
                title="Hoàn tác nét vẽ vừa vẽ"
              >
                <Undo2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleClearAllDrawings}
                className="p-2 rounded-xl text-[#737973] hover:text-[#825249] hover:bg-white transition-all cursor-pointer"
                title="Thùng rác: Xóa toàn bộ nét vẽ"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* VÙNG CHỨA BIỂU ĐỒ NẾN VÀ LỚP CANVAS VẼ BÁM NẾN */}
            <div className="flex-1 h-full relative overflow-hidden bg-[#fff8f0]">
              <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />
              <canvas
                ref={canvasOverlayRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                className={`absolute inset-0 w-full h-full z-10 ${
                  activeTool !== 'CURSOR' ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
                }`}
              />
            </div>
          </div>
        </div>

        {/* CỘT BÊN PHẢI: BẢNG DANH SÁCH LỆNH MT5 (MÀU KEM ĂN NHẬP THEME APP) */}
        <div className="w-full lg:w-[350px] xl:w-[380px] shrink-0 h-full flex flex-col bg-white rounded-2xl border border-[#d8d0c5] p-3 shadow-[4px_6px_16px_rgba(125,110,95,0.06)]">
          
          {/* HEADER DANH SÁCH */}
          <div className="flex items-center justify-between pb-2.5 border-b border-[#e2dbd0] shrink-0">
            <span className="font-bold text-[#1d1b17] text-xs uppercase tracking-wider">
              DANH SÁCH LỆNH ({filteredTrades.length})
            </span>

            {/* BỘ CHỌN SYMBOL ĐƯỢC ĐẶT NGAY TẠI GÓC PHẢI THAY THẾ CHỮ TĨNH XAUUSD */}
            <select
              value={selectedSymbol}
              onChange={(e) => handleSymbolChange(e.target.value)}
              className="bg-[#ede7df] border border-[#d8d0c5] text-xs font-mono font-black text-[#1d1b17] rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#4a6152] cursor-pointer"
            >
              {uniqueAccountSymbols.length > 0 && (
                <optgroup label="Tài Khoản MT5">
                  {uniqueAccountSymbols.map((sym) => (
                    <option key={`acc-${sym}`} value={sym}>
                      {sym}
                    </option>
                  ))}
                </optgroup>
              )}

              {POPULAR_SYMBOLS.map((grp) => (
                <optgroup key={grp.group} label={grp.group}>
                  {grp.items.map((sym) => (
                    <option key={sym} value={sym}>
                      {sym}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* DANH SÁCH CUỘN MƯỢT MÀ */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 pt-2">
            {filteredTrades.length === 0 ? (
              <div className="p-6 text-center text-[#737973] text-xs">
                Không tìm thấy lệnh nào.
              </div>
            ) : (
              filteredTrades.map((tr) => {
                const isSelected = (activeTrade && (activeTrade.ticket === tr.ticket || activeTrade.id === tr.id)) ||
                                   (tr.symbol && tr.symbol.toUpperCase().trim() === selectedSymbol);
                const isBuy = tr.type === 'BUY';
                const pnl = Number(tr.pnl) || 0;
                const isWin = pnl > 0;
                const isBE = pnl === 0;

                return (
                  <div
                    key={tr.ticket || tr.id}
                    onClick={() => {
                      setActiveTrade(tr);
                      if (tr.symbol) setSelectedSymbol(tr.symbol.toUpperCase().trim());
                      if (onSelectTrade) onSelectTrade(tr);
                    }}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#ede7df] border-[#4a6152] shadow-sm ring-1 ring-[#4a6152]/40'
                        : 'bg-[#fcfaf7] border-[#e2dbd0] hover:bg-[#ede7df] hover:border-[#4a6152]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-mono font-black text-xs px-1.5 py-0.5 rounded-md border ${
                          isBuy
                            ? 'bg-[#cee9d6] text-[#092014] border-[#4a6152]/30'
                            : 'bg-[#ffdad4] text-[#93000a] border-[#825249]/30'
                        }`}>
                          {tr.type}
                        </span>
                        <span className="font-mono font-black text-xs text-[#1d1b17]">
                          {tr.symbol}
                        </span>
                        <span className="text-[11px] font-mono text-[#737973] font-bold">
                          {tr.volume}L
                        </span>
                      </div>

                      <span className={`font-mono font-black text-xs ${
                        isWin ? 'text-[#4a6152]' : isBE ? 'text-[#737973]' : 'text-[#825249]'
                      }`}>
                        {pnl > 0 ? `+${pnl.toFixed(2)}$` : `${pnl.toFixed(2)}$`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono mt-1.5 text-[#424843]">
                      <span>
                        Vào: <strong className="text-[#1d1b17]">{tr.open_price}</strong>
                      </span>
                      <span>
                        Ra: <strong className="text-[#1d1b17]">{tr.close_price || 'Open'}</strong>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-[#737973] mt-1">
                      <span>{formatTradeTime(tr.open_time)}</span>
                      <span>#{tr.ticket || tr.id}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
