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

### 4. Tab Báo Cáo — TRỌNG TÂM CỦA APP (`src/components/reports/`)
- Đây là **nhật ký báo cáo**, không phải nhật ký vào lệnh. Mục tiêu: biến dữ liệu thật thành con số để Thầy biết tâm lý đang ở mức nào.
- Mọi công thức nằm ở **một chỗ duy nhất** (có bài kiểm tra `npm test`):
  - `src/utils/reportPositions.ts`: gom lệnh thành vị thế (cắt từng phần 1.1/1.2 = 1 vị thế), **1R tính từ lãi/lỗ thật của lệnh** (đúng mọi mã: vàng, forex, US30, crypto); lệnh không SL = không có R (không giả định 100$).
  - `src/utils/reportStats.ts`: tổng quan, đường vốn & sụt giảm, theo nhóm, heatmap giờ×thứ, MFE/MAE, cắt từng phần, giả lập What-If.
  - `src/utils/psychologyScore.ts`: Điểm Tâm Lý 0–100 (10 chỉ số tự động từ MT5: trả thù, tăng lot sau thua, đánh quá tay, thua 2 lệnh liền vẫn đánh, không SL, lỗ vượt 1R, gồng lỗ, hụt ăn, cắt non, ngoài plan). Mẫu < 5 không tính điểm tổng. Ngưỡng Thầy chỉnh được. Luật quỹ (prop firm).
  - `src/utils/reportPeriods.ts`: kỳ Tuần/Tháng/Quý/Tùy chọn, so kỳ trước. `src/utils/reportMessage.ts`: nội dung báo cáo/cảnh báo gửi Telegram.
- Giao diện: `ReportsView.tsx` (trang chính) + `sections.tsx` + `ui.tsx` (màu: lãi `#2e6b4a`, lỗ `#a3402f`, chữ phụ `#5a605a`, số dùng font chính tabular-nums).
- Bản cũ `src/components/ReportsTab.tsx` (7.500 dòng) còn giữ tạm qua nút "Bản cũ" để so sánh — xóa khi Thầy duyệt xong.
- Tab Tổng Quan (`OverviewTab.tsx`) chưa viết lại, nên chuyển sang dùng chung `reportStats`.

---

## 5. THIẾT LẬP MÔI TRƯỜNG & HƯỚNG DẪN LỆNH CHO CLAUDE
- **Hệ điều hành**: Windows, PowerShell 5.1. Lệnh npm chạy qua `cmd /c` (build: `cmd /c npm run build`, test: `cmd /c npx vitest run`).
- **Sửa file**: dùng Edit/Write. Nếu buộc phải sửa bằng PowerShell thì luôn `[IO.File]::ReadAllText(path, [Text.Encoding]::UTF8)` — đọc thiếu UTF-8 sẽ làm hỏng chữ tiếng Việt.
- **Thư mục dự án**: `C:\Users\IVL\Desktop\Claude\big-deal`. Git: `https://github.com/ltftlht-ship-it/nhatkylomdom.git` (nhánh `main`, Vercel tự triển khai `nhatkylomdom.vercel.app`). Kho GitHub đang CÔNG KHAI — nên đổi Private.
- **Supabase** (project `fvwcanltqxeorfgemxel`, gói Free, Egress 5GB/tháng — tháng 10/2026 đã vượt, app đã giảm ~99% lượng tải):
  - Bảng: `trades`, `plans`, `licenses` (thành viên), `ea_keys`, `user_settings` (cấu hình đồng bộ), `notify_settings`, `notify_log`, `app_secrets`. Kho ảnh riêng tư `journal` (ảnh lưu tham chiếu `sb://journal/...`).
  - Đã bật RLS: người lạ không đọc được gì; Admin duy nhất `ltf.tlht@gmail.com` (`ADMIN_EMAILS` trong `src/lib/supabase.ts` khớp `is_admin()` trong SQL); thành viên chỉ thấy số tài khoản MT5 trong bảng `licenses`.
  - SQL đã chạy (thư mục `supabase/`): `security.sql`, `ea_gateway.sql`, `lock_tables.sql`, `user_settings.sql`, `journal_storage.sql`, `notify.sql`.
  - App tải nhẹ: danh sách lệnh không kèm ảnh/nến; ảnh tải khi chọn lệnh; kiểm tra thay đổi mỗi 60 giây bằng "dấu vân tay".
- **EA MT5**: `mt5/FlatFintech_V4.mq5` (để trống `InpEaSecret`). Ghi lệnh qua `rpc/ea_upsert_trade` / `rpc/ea_update_status` có mật mã. Mật mã Admin (`account_id='*'`, dùng cho mọi tài khoản) chỉ nằm trong `supabase/ea_keys.local.sql` (không lên git) và đã gắn sẵn vào EA trong các terminal (Five Percent Online, Tk100k, Exness). Sao lưu EA V3: `mt5/backup_*`.
- **Thông báo**: Edge Function `notify` (nguồn `supabase/functions/notify/index.ts`, đóng gói 1 file bằng `node scripts/build-notify.mjs` → `supabase/functions/notify-bundle/index.ts`, dán vào trình soạn của Supabase để triển khai). Verify JWT đã TẮT (hàm tự kiểm tra mã `app_secrets` + đăng nhập). Bot Telegram `@bigdeal_nhatky_baocao_bot`, token ở Secrets `TELEGRAM_BOT_TOKEN` (Claude không được tự nhập token). Lịch pg_cron: tuần (T2), tháng (ngày 1), quý — 08:00 giờ VN. Cảnh báo tức thì qua trigger `trades_notify`. Email: chưa bật (cần `RESEND_API_KEY`).

---

## 6. NHẬT KÝ BÀN GIAO (cập nhật 30/10/2026)
- **Đã xong**: bảo mật (bỏ cửa hậu PIN/phiên giả, RLS, cổng EA có mật mã), bỏ số liệu bịa, Winrate đồng nhất, nến biểu đồ đúng mã, Tab Báo Cáo mới, đồng bộ cấu hình lên Supabase, ảnh nhật ký vào kho riêng tư, plan lưu được lên Supabase, thông báo Telegram (đã gửi thật báo cáo tuần 19–25/10).
- **Còn lại / nên làm tiếp**:
  1. Thầy duyệt Tab Báo Cáo mới → xóa `ReportsTab.tsx` cũ và nút "Bản cũ"; viết lại Tab Tổng Quan dùng chung `reportStats`.
  2. Bật email (Resend) nếu Thầy cần.
  3. Giảm số lần tải lặp danh sách lệnh khi mở app (~6 lần, do code cũ gọi lại).
  4. Chia nhỏ bundle (1,7MB) để mở nhanh trên điện thoại; bỏ song ngữ.
  5. EA: phần quét lệnh Limit đang chờ chỉ in log, chưa gửi; đếm số lần dời SL luôn ra 0.
  6. Rà luồng Plan → Lịch Sử khi Thầy bắt đầu dùng thật (gắn plan, checklist, lỗi tâm lý).
- **Quy tắc**: test bằng `cmd /c npx vitest run` + `cmd /c npm run build` trước khi báo cáo; làm trên localhost, gom xong mới đẩy GitHub một lần.