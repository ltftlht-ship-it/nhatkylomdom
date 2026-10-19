# HỒ SƠ DỰ ÁN & HƯỚNG DẪN BÀN GIAO CHO CLAUDE (BIG-DEAL TERMINAL)
*Tài liệu toàn diện cô đọng toàn bộ kiến trúc, nghiệp vụ trading, logic tính toán, quy tắc an toàn và hướng dẫn phát triển dành riêng cho Claude khi tiếp quản dự án.*

---

## 1. THÔNG TIN CHỦ SỞ HỮU & QUY TẮC XƯNG HÔ (BẮT BUỘC TUÂN THỦ)
- **Chủ sở hữu**: Thầy Hoàng Ngọc Đăng Tài.
- **Địa bàn**: Đà Lạt.
- **Lĩnh vực hoạt động**: Tài chính - Trader độc lập (Forex, Vàng XAUUSD, Tiền mã hóa, Chỉ số US30/NAS100) & Giao dịch tài khoản quỹ cấp vốn (Prop firm - tuân thủ nghiêm ngặt quy tắc rủi ro và drawdown).
- **Phần mềm BIG-DEAL (Nhật Ký Lôm Đôm)**: Trading Journal & Execution Analytics Terminal chuyên sâu, kết nối trực tiếp với MetaTrader 5 (MT5) qua Supabase để kiểm toán hiệu suất, kỷ luật và tâm lý giao dịch.
- **Cách xưng hô bắt buộc**: AI luôn gọi là **Thầy**, tự xưng là **em** (lễ phép, chuẩn mực, ngắn gọn, súc tích).
- **Tác phong làm việc**:
  - Đi thẳng vào kết quả, không dài dòng lan man hay giảng giải lý thuyết thừa thãi.
  - Thân thiện cho người dùng Non-tech: Dùng từ ngữ đời thường, gần gũi, thực tế.
  - Chủ động trọn gói từ A-Z: Tự tư duy, đề xuất giải pháp tối ưu và bắt tay làm trọn vẹn.
  - Tuyệt đối bảo mật: Mọi thông tin tài khoản, mật khẩu, số dư vốn, tài khoản quỹ, nhật ký riêng cấm để lộ ra ngoài.
  - Phân định dữ liệu thực hành: Các tài liệu thực hành cũ (như thư mục Mộc An, Agent Boss) chỉ là bài tập, tuyệt đối không gán ghép vào công việc thực tế của Thầy.

---

## 2. LẰN RANH ĐỎ & NGUYÊN TẮC AN TOÀN TUYỆT ĐỐI (CORE PRINCIPLES)
1. **100% DỮ LIỆU THẬT - NGHIÊM CẤM DỮ LIỆU ẢO**:
   - Tuyệt đối không tự ý bịa số liệu, không dùng hệ số nhân ảo (như `* 1.35`, `* 0.8`...).
   - Dữ liệu từ MT5 đẩy lên Supabase là nguồn gốc thật. Nếu thiếu dữ liệu phải báo thẳng cho Thầy, không được tự ý lấp liếm bằng số liệu giả định.
2. **DỮ LIỆU CHỈNH SỬA CỦA THẦY LÀ CHÂN LÝ CUỐI CÙNG (ULTIMATE SOURCE OF TRUTH)**:
   - Khi Thầy chỉnh sửa bất kỳ thông tin nào (bù giờ múi giờ timezone +4h, setup, checklist, giờ vào lệnh, SL, TP, đỉnh MFE, đáy MAE...), TẤT CẢ các tab và biểu đồ (Tổng Quan, Lịch Sử, Báo Cáo, Biểu Đồ) PHẢI tự động cập nhật và tính toán lại ngay lập tức.
3. **LOGIC VỊ THẾ - "CẮT TỪNG PHẦN CHÍNH LÀ 1 LỆNH"**:
   - Khi scale out (chốt lời từng phần), MT5 sinh ra nhiều ticket deal con.
   - BẮT BUỘC dùng hàm `groupTradesByPosition` để gom các lần cắt từng phần thành **1 vị thế duy nhất**.
   - Nhờ đó, Tỉ lệ thắng (Winrate), Số lệnh và PnL ở Tab Tổng Quan và Tab Báo Cáo luôn đồng nhất 100%.
4. **MÚI GIỜ HIỂN THỊ (TIMEZONE OFFSET)**:
   - MT5 chạy theo giờ sàn (thường GMT+2 hoặc GMT+3).
   - App có thiết lập bù giờ hiển thị (mặc định `timezoneOffset = 4` để ra đúng giờ GMT+7 Việt Nam). Mọi bảng biểu, nến và phân bổ phiên (Tokyo/London/NY, biểu đồ nhiệt 24h) đều tính toán chính xác theo giờ đã bù.
5. **KIỂM TOÁN TÂM LÝ & GREED TRAP (BẪY THAM LAM)**:
   - Greed Trap / Hụt ăn: Những lệnh có đỉnh lãi MFE cao nhưng chốt thực tế thấp hoặc âm. Khoảng cách chênh lệch giữa Đỉnh MFE và Thực nhận $\ge 1.5R$ phải được bóc tách đưa vào diện kiểm toán tâm lý.

---

## 3. QUY TẮC THIẾT KẾ GIAO DIỆN (UI/UX DESIGN SYSTEM)
1. **Đồng nhất thiết kế Trading Terminal**:
   - Theme màu: Nền trắng kem sáng dịu (`#fff8f0`, `#ffffff`, `#ede7df`, viền `#d8d0c5`) kết hợp hệ màu bảng MT5 khi cần.
   - Hiệu ứng tương tác: Hover vào hàng/nút đổi sang chữ xanh ngọc (`#4a6152` / `text-emerald-400`).
   - Màu trạng thái lãi/lỗ: Xanh lá (`#4a6152` / `text-emerald-400`) cho Lời/Win, Đỏ hồng (`#825249` / `text-rose-400`) cho Lỗ/Loss, Xám (`#737973`) cho Hòa vốn BE.
2. **Tinh gọn tuyệt đối - Chuẩn trading terminal**:
   - Xóa bỏ icon nhỏ/logo trang trí rườm rà trước tiêu đề hay thẻ để giao diện tập trung vào số liệu.
   - **Tuyệt đối KHÔNG chú thích bất kỳ cái gì khi thiết kế**: Cấm viết các dòng mô tả phụ, subtext, subtitle giải thích lý thuyết hay chú thích rườm rà dưới các tiêu đề, thẻ hay ô nhập liệu. Chỉ giữ tiêu đề ngắn gọn và số liệu / nút bấm thao tác trực tiếp.

---

## 4. CHI TIẾT KỸ THUẬT CÁC TAB & TÍNH NĂNG CHỦ CHỐT

### 1. Tab Biểu Đồ (`src/components/ChartTab.tsx`)
- Gồm 2 Chế độ xem đồng bộ với Sidebar:
  1. **TradingView Pro**: Nhúng widget Advanced Chart chính hãng (`embed-widget-advanced-chart.js`), tự nhận diện ticker chuẩn (OANDA:XAUUSD, BINANCE:BTCUSDT...). Giữ sống trong DOM (`display: none` / `block`) để không mất bản vẽ khi chuyển tab.
  2. **Cắm Cờ Lệnh MT5 (Execution Chart)**:
     - Dùng thư viện `lightweight-charts`.
     - Nạp chuỗi nến thị trường liên tục đầy đủ (500 nến từ Binance / Yahoo qua `fetchRealMarketCandles`) để Thầy có đầy đủ bối cảnh thị trường trước và sau lệnh.
     - Tự động cắm cờ mũi tên nến thật bằng `createSeriesMarkers`: Mũi tên Entry (`arrowUp`) và Exit (`arrowDown`) neo trực tiếp trên thân/râu nến, đi kèm nhãn giá và khối lượng rõ ràng (`BUY 0.91L @ 4123.37`, `EXIT @ 4111.81 (+150$)`). Tuyệt đối không vẽ đường Entry ngang làm rối mắt.
     - **Căn khung nến thông minh**: Căn khung vừa vặn 100 nến (`entryIdx - 40` đến `entryIdx + 60`) ngay tại điểm vào lệnh của lệnh được chọn.
     - **Chống tự động nhảy Zoom**: Dùng `lastFittedTradeRef` để chỉ căn khung 1 lần duy nhất khi Thầy đổi sang lệnh khác. Khi Thầy tự kéo zoom/pan, hệ thống khóa và giữ nguyên góc nhìn của Thầy, không bao giờ tự ý nhảy lại zoom.
     - Bộ công cụ vẽ kỹ thuật bên trái: Cursor, Trendline, Horizontal Line, Rectangle (Order Block/POI), Measure (Pips/giá), Text (BOS/CHoCH), Undo, Clear All. Tọa độ nét vẽ neo chặt theo `(thời gian, mức giá)` nến trên lớp Canvas Overlay, lưu vào `localStorage` (`trade_chart_custom_drawings`).
     - Chọn lệnh bên phải: Highlight chính xác chỉ duy nhất lệnh Thầy click (`isSelected`), hỗ trợ chọn mượt mà toàn bộ các lệnh (Lệnh 1, 2, 3, 4, 5...).

### 2. Tab Lịch Sử Giao Dịch (`src/components/HistoryTab.tsx` & `HistoryTable.tsx`)
- Danh sách lệnh thực tế đẩy từ MT5 lên Supabase.
- Hỗ trợ xem dạng gộp vị thế (Position View) hoặc chi tiết từng ticket (Deals View).
- Chỉnh sửa trực tiếp dữ liệu từng lệnh: Setup, Checklist, Cảm xúc (FOMO, Greed, Revenge...), Ghi chú, Đỉnh MFE, Đáy MAE...
- Xử lý đồng bộ lệnh chờ: Các lệnh Limit đã hủy trên MT5 được lọc bỏ tự động và cập nhật trạng thái `CANCELED` trên Supabase qua `cancelPendingOrderOnSupabase`.

### 3. Tab Kế Hoạch (`src/components/PlansTab.tsx`)
- Lập kế hoạch giao dịch hàng ngày / hàng tuần.
- Bộ checklist kiểm tra điều kiện vào lệnh trước khi thị trường mở cửa.
- Bảng chấm điểm kỷ luật và lỗi tâm lý (-penalty points).
- Đính kèm hình ảnh biểu đồ phân tích kỹ thuật.

### 4. Tab Tổng Quan (`src/components/OverviewTab.tsx`) & Báo Cáo (`src/components/ReportsTab.tsx`)
- Thống kê chỉ số: Balance, Equity, PnL ròng, Win Rate, Profit Factor, Max Drawdown.
- Đồng bộ 100% Winrate và PnL với Tab Báo Cáo thông qua `groupTradesByPosition`.
- Báo cáo Tâm lý & Kỷ luật (FOMO, Greed Trap, vi phạm checklist).
- Hiệu suất MFE & MAE (đỉnh chốt lời và đáy gồng lỗ).
- Giả lập What-If (mô phỏng PnL khi kỷ luật SL/TP).

---

## 5. THIẾT LẬP MÔI TRƯỜNG & HƯỚNG DẪN LỆNH CHO CLAUDE
- **Hệ điều hành**: Windows 11.
- **Thư mục dự án**: `c:\Users\IVL\Documents\antigravity\calm-borg\BIG-deal`.
- **Git Repository**: `https://github.com/ltftlht-ship-it/nhatkylomdom.git` (nhánh `main`).
- **Lưu ý thực thi lệnh trên Windows**:
  - Do chính sách Execution Policy của PowerShell, khi chạy lệnh npm cần dùng tiền tố `cmd /c`:
    - Chạy build kiểm tra: `cmd /c npm run build`
    - Khởi động dev server: `cmd /c npm run dev`
- **Môi trường Database**:
  - Supabase kết nối qua biến môi trường trong file `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
  - Các bảng chính: `trades`, `plans`, `accounts`, `settings`.

---

## 6. NHẬT KÝ BÀN GIAO TIẾP QUẢN (HANDOVER NOTE)
- **Tình trạng hiện tại**:
  - Biểu đồ nến thị trường liên tục đầy đủ (500 nến) đã được khôi phục chuẩn xác.
  - Cắm cờ mũi tên nến thật hoạt động mượt mà cho tất cả các lệnh khi Thầy click chọn.
  - Lỗi co rúm nến và lỗi tự động nhảy lại zoom khi xem biểu đồ đã được xử lý triệt để.
  - Dự án đã vượt qua kiểm tra build production (`cmd /c npm run build`) với 0 lỗi, mã nguồn sẵn sàng 100%.
- **Nhiệm vụ tiếp theo khi Thầy yêu cầu**:
  - Đọc kỹ yêu cầu mới của Thầy, tuân thủ nguyên tắc xưng hô "Thầy - em" và các lằn ranh đỏ ở Mục 1 & 2.
  - Thực hiện thay đổi chính xác, test lại bằng `cmd /c npm run build` trước khi báo cáo kết quả cho Thầy.
