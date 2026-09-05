export type TradeType = 'BUY' | 'SELL';
export type TradeSession = 'Á' | 'Âu' | 'Mỹ' | 'Tokyo' | 'London' | 'New York';
export type TradeStatus = 'OPEN' | 'CLOSED' | 'PENDING' | 'PENDING_PLAN';
export type TradeResult = 'Win' | 'Loss' | 'BE';

export interface TradeRow {
  // Core Data (Chuẩn bị Supabase / EA MT5)
  id: string;
  ticket: string;
  position_id: string; // Dùng gom cụm scaling 1.1, 1.2
  account_id?: string; // Tài khoản MT5 của lệnh
  symbol: string;
  type: TradeType;
  volume: number; // KL (lot)
  open_price: number;
  close_price: number;
  initial_sl: number;
  pnl: number; // Gross PnL
  commission: number;
  swap: number;
  open_time: string; // YYYY-MM-DD HH:mm:ss
  close_time: string; // YYYY-MM-DD HH:mm:ss

  // App Computed Data
  pip_sl: number; // |open_price - initial_sl|
  risk_1r_usd: number; // pip_sl * volume * contract_size
  net_pnl: number; // pnl + commission + swap
  weighted_rr: number; // net_pnl / risk_1r_usd
  lost_profit: number; // plan_pnl - net_pnl (Nếu có lỗi Cắt Non)

  // Tags & Metadata
  timeframe: 'D1' | 'H4' | 'H1' | 'M30' | 'M15' | 'M5' | 'M1' | string;
  session: 'Á' | 'Âu' | 'Mỹ';
  image_url_1?: string; // Ô số 1: Ảnh Pre-trade được đồng bộ từ Plan đã map sang
  image_base64?: string; // Ô số 2: Ảnh chụp màn hình lúc đóng lệnh do con EA v3.02 đẩy tự động lên Supabase
  htf_image_url?: string; // Ảnh Khung Lớn HTF (tương đương image_url_1)
  ltf_image_url?: string; // Ảnh Khung Vào Lệnh LTF (tương đương image_base64)
  pre_checklist_ids: string[]; // Danh sách ID tiêu chí kỷ luật
  post_checklist_ids: string[]; // Danh sách ID lỗi tâm lý (FOMO, Cắt non...)
  notes: string;
  plan_id: string | null;
  plan_name?: string; // Tên Plan được map

  // Additional detail fields
  plan_pnl?: number; // PnL Kế hoạch đặt ra (USD)
  status: TradeStatus;
  sub_index?: string; // 1.1, 1.2 cho lệnh chia nhỏ / scaling
  tp1_r?: number;
  tp2_r?: number;
  tp3_r?: number;
  setup?: string; // Setup chính
  setups?: string[]; // Danh sách Setup (Cực Trị, POI sau IDM...)
  result?: TradeResult;
  pnl_percentage?: number;
  running_balance?: number;
  is_noise?: boolean; // Lệnh rác (Volume <= 0.01 lot)
}

export interface TradeGroup {
  position_id: string;
  ticket: string;
  account_id?: string;
  symbol: string;
  type: TradeType;
  total_volume: number;
  avg_open_price: number;
  avg_close_price: number;
  pip_sl: number;
  initial_sl: number;
  open_time: string;
  close_time: string;
  net_pnl: number;
  total_commission?: number; // Tổng phí commission của các deal
  total_swap?: number; // Tổng swap của các deal
  total_gross_pnl?: number; // Tổng PnL gộp
  weighted_rr: number;
  pnl_percentage: number;
  result: TradeResult;
  session: 'Á' | 'Âu' | 'Mỹ';
  running_balance: number;
  is_noise?: boolean; // Vị thế rác (total_volume <= 0.01)
  plan_id?: string | null;
  plan_name?: string;
  trades: TradeRow[]; // Các sub-trade nếu có scaling (1.1, 1.2)
  master_trade: TradeRow; // Trade chính đại diện
}

export interface PendingOrder {
  id: string;
  ticket: string;
  symbol: string;
  type: TradeType;
  volume: number;
  order_type: 'BUY LIMIT' | 'SELL LIMIT' | 'BUY STOP' | 'SELL STOP';
  price: number;
  sl: number;
  tp: number;
  placed_time: string;
  plan_id: string | null;
  plan_title?: string;
  notes?: string;
  status: 'PENDING';
}

export interface PreChecklistItem {
  id: string;
  label: string;
  points: number;
  description?: string;
}

export interface PostMistakeItem {
  id: string;
  label: string;
  penalty_points: number;
  is_early_exit?: boolean; // Cắt non
  description?: string;
}

export interface SetupTagItem {
  id: string;
  label: string;
  color?: string;
}

export interface AppSettings {
  timezone_offset_hours: number; // Múi Giờ Offset (ví dụ: +4 tiếng để quy đổi giờ Server MT5 về giờ Việt Nam UTC+7)
  auto_classify_session: boolean;
  contract_sizes: Record<string, number>; // Ví dụ: 'XAU/USD': 100, 'EUR/USD': 100000
  hide_noise_trades?: boolean; // Lọc lệnh rác (Volume <= 0.01 lot) ra khỏi thống kê
  hide_noise_rows?: boolean; // Ẩn hẳn khỏi Bảng Lịch Sử (nếu false: chỉ làm mờ và gắn nhãn)
  fixed_1r_usd?: number; // Mức Risk 1R cố định khi không có SL (Mặc định: $100)
}

export interface TradingPlan {
  id: string;
  plan_name: string; // Tên Plan tự động: [Symbol] - [YYYY-MM-DD HH:mm]
  symbol: string;
  account_id?: string; // Tài khoản MT5 của Plan
  timeframe: string; // M15, H1, H4, D1...
  setup?: string; // Tên Setup
  notes?: string; // Ghi chú phân tích
  checklist?: string[]; // Danh sách ID tiêu chí kỷ luật
  image_url?: string; // Ảnh Pre-trade từ clipboard paste Ctrl+V hoặc file
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'READY' | 'TRIGGERED' | 'EXPIRED';
  created_at: string;

  // Legacy / extra fields
  code?: string;
  title?: string;
  type?: TradeType;
  entry_zone?: string;
  sl_target?: string;
  tp_target?: string;
  rr_estimate?: string;
  bias?: string;
}

export interface AccountInfo {
  id: string;
  name: string;
  ticket_server: string;
  balance: number;
  initial_balance: number;
  pnl: number;
  win_rate: number;
  total_rr?: number;
  noise_count?: number;
  wins: number;
  losses: number;
  breakeven: number;
  connected: boolean;
  currency: string;
}
