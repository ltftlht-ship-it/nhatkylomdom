# BIG-DEAL: KIẾN TRÚC HỆ THỐNG & TÀI LIỆU VẬN HÀNH TOÀN DIỆN
*(System Architecture, Business Logic & Operational Guidelines)*

---

## I. MỤC TIÊU & BỐI CẢNH DỰ ÁN
Ứng dụng **BIG-DEAL** là Terminal Nhật ký Giao dịch và Phân tích Thực chiến (Trading Journal & Execution Analytics) được xây dựng dành riêng cho **Thầy Hoàng Ngọc Đăng Tài** – Trader tự do và Trader tài khoản quỹ cấp vốn (Prop firm).

Ứng dụng giải quyết 4 bài toán cốt lõi:
1. **Tự động hóa nhật ký lệnh**: Đồng bộ trực tiếp lệnh giao dịch thật từ MetaTrader 5 (MT5) lên cơ sở dữ liệu Supabase.
2. **Kiểm toán tâm lý & kỷ luật**: Bóc tách các lỗi giao dịch như FOMO, Revenge Trading, và đặc biệt là **Greed Trap (Bẫy tham lam / Cú hụt ăn)**.
3. **Phân tích hiệu suất vị thế chuẩn xác**: Gom các lệnh cắt từng phần (Scale-out) thành một vị thế duy nhất để phản ánh đúng 100% tỉ lệ thắng (Win Rate) và kỳ vọng toán học (Expectancy).
4. **Trực quan hóa thực chiến**: Tích hợp biểu đồ TradingView Pro song song với biểu đồ cắm cờ nến thật MT5 kèm bộ công cụ vẽ kỹ thuật không bị trôi lệch toạ độ.

---

## II. 5 NGUYÊN TẮC NGHIỆP VỤ BẤT DI BẤT DỊCH (CORE BUSINESS LOGIC)

### 1. 100% Dữ Liệu Thật – Tuyệt đối không dữ liệu ảo
- Không sử dụng bất kỳ hệ số nhân ảo nào (`* 1.35`, `* 0.8`...).
- Dữ liệu gốc lấy từ MT5 / Supabase. Trường hợp thiếu dữ liệu (ví dụ EA chưa đẩy High/Low hoặc SL = 0) phải thông báo trực tiếp cho Thầy, không được tự ý bịa số liệu.

### 2. Dữ liệu chỉnh sửa bởi Thầy là Chân Lý Cuối Cùng (Ultimate Source of Truth)
- MT5 đẩy dữ liệu thô ban đầu, nhưng khi Thầy bổ sung hoặc chỉnh sửa (múi giờ bù giờ +4h, setup, checklist, SL, TP, đỉnh MFE, đáy MAE...):
  - Dữ liệu Thầy chỉnh sửa sẽ ghi đè và là nguồn dữ liệu chuẩn nhất.
  - Mọi Tab (Tổng Quan, Lịch Sử, Kế Hoạch, Biểu Đồ, Báo Cáo) và mọi đồ thị thống kê (Heatmap 24h, phân bổ phiên Tokyo/London/NY, Winrate, PnL) phải tự động tính toán lại theo dữ liệu đã chỉnh sửa đó ngay lập tức.

### 3. Logic Vị Thế: "Cắt từng phần chính là 1 lệnh"
- Khi Thầy vào 1 lệnh 1.0 lot và chốt lời từng phần (scale out) thành 3 lần: 0.5 lot, 0.3 lot, 0.2 lot:
  - MT5 sinh ra 3 ticket giao dịch riêng biệt.
  - Ứng dụng bắt buộc sử dụng logic `groupTradesByPosition` để gom 3 ticket này thành **1 vị thế duy nhất**.
  - Lọc bỏ các dòng rác khớp lệnh khối lượng $\le 0.01$ lot.
  - Nhờ vậy, Tab Tổng Quan và Tab Báo Cáo luôn đồng bộ 100% về tỉ lệ thắng (Winrate), số lượng lệnh và PnL.

### 4. Múi giờ hiển thị đồng bộ (+4h)
- Giờ MT5 là giờ máy chủ của sàn (GMT+2 hoặc GMT+3).
- Ứng dụng cấu hình bù giờ hiển thị mặc định `timezone_offset_hours = 4` (để ra chuẩn giờ GMT+7 Việt Nam). Mọi phân bổ phiên, mốc giờ nến, nhãn thời gian đều phải qua hàm chuẩn hóa `formatTradeTime` và `parseTradeTimeToDisplayUnixSec`.

### 5. Kiểm toán Greed Trap (Cú hụt ăn)
- Định nghĩa: Những lệnh giá đã chạy chạm đỉnh lợi nhuận cao (Đỉnh MFE cao) nhưng Thầy không chốt hoặc dời SL hòa vốn, khiến kết quả thực nhận về thấp hoặc âm.
- Ngưỡng bóc tách: Độ chênh lệch giữa Đỉnh MFE và Thực nhận $\ge 1.5R$ được tự động gắn cờ và phân tích trong mục Kiểm toán Tâm lý.

---

## III. QUY TẮC THIẾT KẾ UI/UX (TERMINAL DESIGN SYSTEM)
1. **Hệ màu chuẩn Trading Terminal**:
   - Nền kem dịu mắt: `#fff8f0`, thẻ trắng `#ffffff`, viền `#d8d0c5`, nền phụ `#ede7df`.
   - Hover bảng và nút: Luôn đổi sang xanh ngọc đậm `#4a6152` hoặc emerald/teal.
   - Màu PnL: Xanh lá (`#4a6152` / `text-emerald-400`) cho Lãi/Win, Đỏ hồng (`#825249` / `text-rose-400`) cho Lỗ/Loss, Xám `#737973` cho Hòa vốn BE.
2. **Nguyên tắc "Không chú thích rườm rà"**:
   - Tuyệt đối cấm viết các dòng mô tả phụ, subtext giải thích lý thuyết trading dưới các tiêu đề hoặc thẻ.
   - Giữ giao diện tinh gọn tuyệt đối: chỉ có tiêu đề ngắn gọn và số liệu / nút thao tác.

---

## IV. BẢN ĐỒ CÁC COMPONENT CHÍNH & VAI TRÒ KỸ THUẬT

| Component | Vị trí | Chức năng chính |
|---|---|---|
| `App.tsx` | `src/App.tsx` | Quản lý state toàn cục, kết nối Supabase, đồng bộ danh sách tài khoản thật, giữ `ChartTab` luôn sống trong DOM. |
| `Sidebar.tsx` | `src/components/Sidebar.tsx` | Thanh điều hướng Tactile Rail + Submenu Trading Hub, phát sự kiện chuyển tab và chế độ biểu đồ (`deal_chart_mode_changed`). |
| `OverviewTab.tsx` | `src/components/OverviewTab.tsx` | Tổng quan tài khoản, thống kê Winrate/PnL đã gom vị thế, phân bổ phiên Tokyo/London/NY, biểu đồ nhiệt 24h. |
| `HistoryTab.tsx` / `HistoryTable.tsx` | `src/components/` | Bảng lịch sử lệnh thật từ MT5, hỗ trợ xem vị thế gộp, chỉnh sửa setup/checklist/tâm lý trực tiếp. |
| `PlansTab.tsx` | `src/components/PlansTab.tsx` | Lập kế hoạch giao dịch ngày/tuần, checklist điều kiện vào lệnh, lưu ảnh chart TradingView. |
| `ChartTab.tsx` | `src/components/ChartTab.tsx` | Chế độ kép: TradingView Pro (widget chính thức) & Cắm cờ MT5 (Lightweight Charts + công cụ vẽ độc lập, bám nến, không giật nháy). |
| `ReportTab.tsx` | `src/components/ReportTab.tsx` | Báo cáo chuyên sâu: Tâm lý FOMO/Greed Trap, MFE/MAE, Giả lập What-If, Cắt lệnh từng phần. |

---

## V. CƠ CHẾ KỸ THUẬT ĐẶC BIỆT CỦA CHARTTAB
1. **Cô lập Canvas Overlay**:
   - Lớp nến thị trường `lightweight-charts` chỉ khởi tạo 1 lần duy nhất khi vào chế độ `execution`.
   - Các nét vẽ (Trendline, Horizontal Line, Rectangle, Measure, Text) được vẽ trên một lớp Canvas trong suốt (`canvasOverlayRef`) nằm đè lên trên.
   - Thao tác kéo chuột vẽ được tối ưu bằng `requestAnimationFrame`. Khi chuyển công cụ hoặc vẽ hình mới, canvas chỉ vẽ lại tức thì mà KHÔNG chạm vào biểu đồ nến, loại bỏ 100% tình trạng chớp nháy.
2. **Khóa toạ độ bám nến**:
   - Mỗi nét vẽ lưu tọa độ theo `{ time: UnixTimestamp, price: number }`.
   - Khi người dùng Pan hoặc Zoom biểu đồ, sự kiện `subscribeVisibleLogicalRangeChange` gọi `redrawShapes()`, chuyển đổi toạ độ sang pixel màn hình tức thì, giúp nét vẽ dính chặt vào nến mà không bị trôi lệch.
3. **Lưu trữ bản vẽ**: Tự động lưu và phục hồi qua `localStorage` (`trade_chart_custom_drawings`).
