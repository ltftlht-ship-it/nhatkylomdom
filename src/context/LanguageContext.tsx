import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'en' | 'vi';

export const translations = {
  en: {
    // Navigation & General
    'nav.overview': 'Overview',
    'nav.history': 'Trading History',
    'nav.plans': 'Trading Plans',
    'nav.reports': 'Analytics Reports',
    'nav.chart': 'Chart Review',
    'nav.settings': 'Settings',
    'nav.addAccount': 'Add MT5 Account',
    'nav.selectAccount': 'Select Account',
    'nav.connected': 'Connected',

    // Common Actions
    'common.all': 'All',
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.saveChanges': 'Save Changes',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.confirm': 'Confirm',
    'common.search': 'Search...',
    'common.reset': 'Reset',
    'common.active': 'Active',
    'common.pending': 'Pending',
    'common.executed': 'Executed',
    'common.closed': 'Closed',
    'common.open': 'Open',
    'common.win': 'Win',
    'common.loss': 'Loss',
    'common.breakeven': 'Break-even',

    // Header
    'header.title': 'Trade Journal Pro',
    'header.searchPlaceholder': 'Search tickets, symbols, setups...',
    'header.sync': 'Sync Supabase',
    'header.syncing': 'Syncing...',
    'header.synced': 'Synced',
    'header.settings': 'System Settings & Offset',
    'header.language': 'Language / Ngôn ngữ',
    'header.import': 'Import MT5',
    'header.notifications': 'Notifications',

    // Overview Tab (Dashboard)
    'dash.title': 'PROP TRADING DASHBOARD',
    'dash.subtitle': 'Trade Journal analytics & account growth trajectory',
    'dash.accountBalance': 'Account Balance',
    'dash.startingCapital': 'Starting Capital',
    'dash.netPnl': 'Net P&L',
    'dash.profitTarget': 'Profit Target',
    'dash.dailyLossLimit': 'Daily Loss Limit',
    'dash.maxDrawdown': 'Max Drawdown',
    'dash.remainingToPass': 'Remaining to pass',
    'dash.bufferRemainingToday': 'Buffer remaining today',
    'dash.overallCushion': 'Overall cushion',
    'dash.criticalRisk': 'CRITICAL RISK',
    'dash.safe': 'SAFE',
    'dash.inProfit': 'IN PROFIT',
    'dash.inDrawdown': 'IN DRAWDOWN',
    'dash.equityCurve': 'EQUITY CURVE & BALANCE TRAJECTORY',
    'dash.dailyPnlBreakdown': 'DAILY P&L BREAKDOWN (BAR CHART)',
    'dash.rMultiple': 'R-MULTIPLE PERFORMANCE CURVE',
    'dash.cumulativeBtn': 'Cumulative ($)',
    'dash.dailyPnlBtn': 'Daily P&L',
    'dash.rMultipleBtn': 'R-Multiple',
    'dash.winRate': 'Win Rate',
    'dash.profitFactor': 'Profit Factor',
    'dash.avgWinLoss': 'Avg Win / Loss',
    'dash.expectancy': 'Trade Expectancy',
    'dash.totalTrades': 'Total Trades',
    'dash.tiltmeter': 'TILTMETER & DISCIPLINE AUDIT',
    'dash.disciplineScore': 'Discipline Score',
    'dash.potentialPnl': 'Potential P&L',
    'dash.costOfMistakes': 'Cost of Mistakes (Top Leaks)',
    'dash.calendarHeatmap': 'MONTHLY P&L CALENDAR HEATMAP',
    'dash.weeklyTotal': 'Total',
    'dash.performanceBySetup': 'PERFORMANCE BY SETUP',
    'dash.longVsShort': 'LONG VS SHORT ANALYSIS',
    'dash.killzones': 'KILLZONE SESSIONS',

    // History Tab
    'history.title': 'TRADING HISTORY',
    'history.allTrades': 'All Trades',
    'history.filter': 'Filter',
    'history.showing': 'Showing',
    'history.ticket': 'Ticket',
    'history.status': 'Status',
    'history.symbol': 'Symbol',
    'history.type': 'Type',
    'history.volume': 'Volume',
    'history.openPrice': 'Open Price',
    'history.closePrice': 'Close Price',
    'history.netPnl': 'Net P&L',
    'history.time': 'Time',
    'history.setup': 'Setup',
    'history.tf': 'TF',
    'history.discipline': 'Discipline',
    'history.psychology': 'Psychology',
    'history.tradeNotes': 'Trade Notes',
    'history.preTradePlan': '1. Pre-Trade (Plan)',
    'history.postTradeClose': '2. Post-Trade (Close)',
    'history.selectedTrade': 'Selected Trade',
    'history.mappingPlan': 'Plan',
    'history.hideNoise': 'Hide Noise Trades',

    // Plans Tab
    'plans.title': 'TRADING PLANS',
    'plans.createBtn': 'CREATE NEW TRADING PLAN',
    'plans.closeForm': 'CLOSE PLAN FORM',
    'plans.editTitle': 'EDIT TRADING PLAN',
    'plans.createTitle': 'PLAN CONFIGURATION',
    'plans.symbol': 'Symbol',
    'plans.planName': 'Plan Name',
    'plans.setupMulti': 'Setup (Multi-select)',
    'plans.tfMulti': 'TF (Multi-select)',
    'plans.disciplineChecklist': 'Discipline Checklist',
    'plans.psychologyRules': 'Psychology Rules',
    'plans.planChart': 'Plan Chart (Pre-Trade)',
    'plans.pressCtrlV': 'Press Ctrl + V to paste chart image',
    'plans.savePlan': 'Save Plan',
    'plans.saveChanges': 'Save Changes',
    'plans.markExecuted': 'Mark as Executed',
    'plans.markPending': 'Mark as Pending',

    // Reports Tab
    'reports.title': 'ADVANCED QUANTITATIVE ANALYTICS & DISCIPLINE AUDIT',
    'reports.allModules': 'All Modules',
    'reports.mod1': '1. Discipline Gap',
    'reports.mod2': '2. Timeframes',
    'reports.mod3': '3. Capital & Fees',
    'reports.mod4': '4. Plan vs Impulse',
    'reports.mod5': '5. What-If & MAE/MFE',
    'reports.mod6': '6. Time Decay',
    'reports.gapTitle': '1. DISCIPLINE GAP & MISTAKE COST MATRIX',
    'reports.tfTitle': '2. MULTI-TIMEFRAME MATRIX',
    'reports.capTitle': '3. CAPITAL MANAGEMENT & BROKER FRICTION',
    'reports.planVsImpTitle': '4. PLANNED TRADES VS IMPULSE TRADES',
    'reports.quantTitle': '5. ADVANCED QUANT: MAE / MFE & WHAT-IF SIMULATOR',
    'reports.decayTitle': '6. POST-WIN STREAK VARIANCE & TIME DECAY',

    // Settings Modal
    'settings.title': 'System Settings & MT5 Configuration',
    'settings.timezoneTab': 'Timezone Offset & Sessions',
    'settings.checklistTab': 'Discipline Checklist',
    'settings.contractTab': 'Contract Size',
    'settings.supabaseTab': 'Supabase Database',
    'settings.languageTab': 'Language / Ngôn ngữ',
    'settings.chooseLang': 'Select Application Language'
  },

  vi: {
    // Navigation & General
    'nav.overview': 'Tổng Quan',
    'nav.history': 'Lịch Sử Giao Dịch',
    'nav.plans': 'Kế Hoạch Giao Dịch',
    'nav.reports': 'Báo Cáo Thống Kê',
    'nav.chart': 'Biểu Đồ TradingView',
    'nav.settings': 'Cài Đặt',
    'nav.addAccount': 'Thêm Tài Khoản MT5',
    'nav.selectAccount': 'Chọn Tài Khoản',
    'nav.connected': 'Đã kết nối',

    // Common Actions
    'common.all': 'Tất cả',
    'common.close': 'Đóng',
    'common.cancel': 'Hủy',
    'common.save': 'Lưu',
    'common.saveChanges': 'Lưu Thay Đổi',
    'common.delete': 'Xóa',
    'common.edit': 'Chỉnh sửa',
    'common.confirm': 'Xác nhận',
    'common.search': 'Tìm kiếm...',
    'common.reset': 'Đặt lại',
    'common.active': 'Hoạt động',
    'common.pending': 'Chờ khớp',
    'common.executed': 'Đã khớp',
    'common.closed': 'Đã đóng',
    'common.open': 'Đang mở',
    'common.win': 'Thắng',
    'common.loss': 'Thua',
    'common.breakeven': 'Hòa vốn',

    // Header
    'header.title': 'Nhật Ký Giao Dịch Pro',
    'header.searchPlaceholder': 'Tìm kiếm ticket, cặp tiền, setup...',
    'header.sync': 'Đồng bộ Supabase',
    'header.syncing': 'Đang đồng bộ...',
    'header.synced': 'Đã đồng bộ',
    'header.settings': 'Cài Đặt Hệ Thống & Offset',
    'header.language': 'Ngôn Ngữ / Language',
    'header.import': 'Nạp Import MT5',
    'header.notifications': 'Thông báo',

    // Overview Tab (Dashboard)
    'dash.title': 'BẢNG ĐIỀU KHIỂN QUẢN LÝ QUỸ (PROP DASHBOARD)',
    'dash.subtitle': 'Phân tích hiệu suất nhật ký & đường cong tăng trưởng tài khoản',
    'dash.accountBalance': 'Số Dư Tài Khoản',
    'dash.startingCapital': 'Vốn Khởi Đầu',
    'dash.netPnl': 'Lợi Nhuận Ròng (Net P&L)',
    'dash.profitTarget': 'Mục Tiêu Lợi Nhuận',
    'dash.dailyLossLimit': 'Giới Hạn Lỗ Hàng Ngày',
    'dash.maxDrawdown': 'Mức Sụt Giảm Tối Đa',
    'dash.remainingToPass': 'Còn lại để qua quỹ',
    'dash.bufferRemainingToday': 'Đệm an toàn còn lại hôm nay',
    'dash.overallCushion': 'Đệm an toàn tổng sụt giảm',
    'dash.criticalRisk': 'RỦI RO NGUY CẤP',
    'dash.safe': 'AN TOÀN',
    'dash.inProfit': 'ĐANG CÓ LÃI',
    'dash.inDrawdown': 'ĐANG SỤT GIẢM',
    'dash.equityCurve': 'ĐƯỜNG CONG TĂNG TRƯỞNG VỐN (EQUITY CURVE)',
    'dash.dailyPnlBreakdown': 'PHÂN PHỐI LÃI LỖ THEO NGÀY (BIỂU ĐỒ CỘT)',
    'dash.rMultiple': 'HIỆU SUẤT THEO BỘI SỐ R (R-MULTIPLE)',
    'dash.cumulativeBtn': 'Lũy Kế ($)',
    'dash.dailyPnlBtn': 'PnL Ngày',
    'dash.rMultipleBtn': 'Bội số R',
    'dash.winRate': 'Tỷ Lệ Thắng',
    'dash.profitFactor': 'Hệ Số Lợi Nhuận',
    'dash.avgWinLoss': 'Lãi / Lỗ Trung Bình',
    'dash.expectancy': 'Kỳ Vọng Toán Học',
    'dash.totalTrades': 'Tổng Số Lệnh',
    'dash.tiltmeter': 'THƯỚC ĐO KỶ LUẬT & TÂM LÝ (TILTMETER)',
    'dash.disciplineScore': 'Điểm Kỷ Luật',
    'dash.potentialPnl': 'Lợi Nhuận Tiềm Năng',
    'dash.costOfMistakes': 'Tiền Phạt Do Vi Phạm Tâm Lý',
    'dash.calendarHeatmap': 'LỊCH NHIỆT PNL HÀNG THÁNG (HEATMAP)',
    'dash.weeklyTotal': 'Tổng Tuần',
    'dash.performanceBySetup': 'HIỆU QUẢ THEO TỪNG SETUP',
    'dash.longVsShort': 'PHÂN TÍCH LỆNH MUA VS BÁN',
    'dash.killzones': 'PHIÊN GIAO DỊCH (KILLZONES)',

    // History Tab
    'history.title': 'LỊCH SỬ GIAO DỊCH',
    'history.allTrades': 'Tất Cả Lệnh',
    'history.filter': 'Bộ Lọc',
    'history.showing': 'Đang hiển thị',
    'history.ticket': 'Mã vé (Ticket)',
    'history.status': 'Trạng thái',
    'history.symbol': 'Cặp tiền',
    'history.type': 'Loại lệnh',
    'history.volume': 'Khối lượng (Lot)',
    'history.openPrice': 'Giá vào',
    'history.closePrice': 'Giá đóng',
    'history.netPnl': 'Lợi nhuận ròng',
    'history.time': 'Thời gian',
    'history.setup': 'Setup',
    'history.tf': 'Khung TG',
    'history.discipline': 'Kỷ luật',
    'history.psychology': 'Tâm lý',
    'history.tradeNotes': 'Ghi Chú Lệnh',
    'history.preTradePlan': '1. Kế Hoạch Trước Lệnh (Plan)',
    'history.postTradeClose': '2. Ảnh Đóng Lệnh (Post-Trade)',
    'history.selectedTrade': 'Chi Tiết Lệnh Được Chọn',
    'history.mappingPlan': 'Gán Kế Hoạch',
    'history.hideNoise': 'Ẩn Lệnh Rác',

    // Plans Tab
    'plans.title': 'KẾ HOẠCH GIAO DỊCH (TRADING PLANS)',
    'plans.createBtn': 'TẠO KẾ HOẠCH MỚI',
    'plans.closeForm': 'ĐÓNG FORM KẾ HOẠCH',
    'plans.editTitle': 'CHỈNH SỬA KẾ HOẠCH',
    'plans.createTitle': 'CẤU HÌNH KẾ HOẠCH',
    'plans.symbol': 'Cặp tiền (Symbol)',
    'plans.planName': 'Tên Kế Hoạch',
    'plans.setupMulti': 'Setup (Chọn nhiều)',
    'plans.tfMulti': 'Khung TG (Chọn nhiều)',
    'plans.disciplineChecklist': 'Tiêu Chí Kỷ Luật',
    'plans.psychologyRules': 'Quy Tắc Tâm Lý',
    'plans.planChart': 'Ảnh Biểu Đồ Kế Hoạch (Pre-Trade)',
    'plans.pressCtrlV': 'Bấm Ctrl + V để dán ảnh biểu đồ từ clipboard',
    'plans.savePlan': 'Lưu Kế Hoạch',
    'plans.saveChanges': 'Lưu Thay Đổi',
    'plans.markExecuted': 'Đánh dấu đã khớp',
    'plans.markPending': 'Đánh dấu chờ khớp',

    // Reports Tab
    'reports.title': 'BÁO CÁO ĐỊNH LƯỢNG HIỆU SUẤT & KỶ LUẬT CHUYÊN SÂU',
    'reports.allModules': 'Tất cả phần',
    'reports.mod1': '1. Thước Đo Kỷ Luật',
    'reports.mod2': '2. Đa Khung Thời Gian',
    'reports.mod3': '3. Quản Lý Vốn & Phí',
    'reports.mod4': '4. Lệnh Plan vs Ngứa Tay',
    'reports.mod5': '5. Giả Lập & MAE/MFE',
    'reports.mod6': '6. Ma Sát Thời Gian',
    'reports.gapTitle': '1. THƯỚC ĐO KỶ LUẬT & MA TRẬN TỔN THẤT CẢM XÚC',
    'reports.tfTitle': '2. BÓC TÁCH KHUNG THỜI GIAN ĐA CẤP',
    'reports.capTitle': '3. QUẢN LÝ VỐN & CHI PHÍ SÀN (FEE DRAG)',
    'reports.planVsImpTitle': '4. ĐỐI SOÁT LỆNH CÓ PLAN VS LỆNH BỘT PHÁT',
    'reports.quantTitle': '5. ĐỊNH LƯỢNG MAE / MFE & BỘ GIẢ LẬP WHAT-IF',
    'reports.decayTitle': '6. HỘI CHỨNG HƯNG PHẤN & MA SÁT THỜI GIAN GỒNG',

    // Settings Modal
    'settings.title': 'Cài Đặt Hệ Thống & Cấu Hình MT5',
    'settings.timezoneTab': 'Múi Giờ Offset & Phiên',
    'settings.checklistTab': 'Tiêu Chí Kỷ Luật (Checklist)',
    'settings.contractTab': 'Kích Thước Hợp Đồng (Contract)',
    'settings.supabaseTab': 'Cơ Sở Dữ Liệu Supabase',
    'settings.languageTab': 'Ngôn Ngữ / Language',
    'settings.chooseLang': 'Chọn Ngôn Ngữ Ứng Dụng'
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const LOCAL_LANG_KEY = 'trade_journal_language';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_LANG_KEY);
      if (saved === 'vi' || saved === 'en') return saved;
    } catch {}
    return 'en'; // Default English as standard, instant toggle to Vietnamese
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LOCAL_LANG_KEY, lang);
    } catch {}
  };

  const toggleLanguage = () => {
    const next = language === 'en' ? 'vi' : 'en';
    setLanguage(next);
  };

  const t = (key: string, fallback?: string): string => {
    const dict = translations[language] as Record<string, string>;
    if (dict && dict[key]) {
      return dict[key];
    }
    const fallbackDict = translations.en as Record<string, string>;
    if (fallbackDict && fallbackDict[key]) {
      return fallbackDict[key];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Safe fallback if used outside provider
    return {
      language: 'en',
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (k: string, f?: string) => f || k
    };
  }
  return ctx;
};
