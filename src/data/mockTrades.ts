import { PreChecklistItem, PostMistakeItem, SetupTagItem } from '../types';

// Danh sách mặc định ban đầu cho checklist, lỗi tâm lý và setup.
// Thầy sửa trong Cấu hình checklist; bản đã sửa được lưu và đồng bộ lên Supabase.

export const DEFAULT_PRE_CHECKLIST: PreChecklistItem[] = [
  { id: 'bias', label: '1. HTF Trend & Market Structure Bias', points: 15 },
  { id: 'poi', label: '2. Vùng POI / Orderblock / Supply-Demand Hợp Lệ', points: 15 },
  { id: 'liquidity', label: '3. Quét Thanh Khoản & Inducement (Sweep IDM / BSL...)', points: 20 },
  { id: 'ltf_confirm', label: '4. Tín Hiệu Xác Nhận LTF (CHoCH / Flip / Sweep M1/M5)', points: 15 },
  { id: 'session', label: '5. Vào Lệnh Đúng Phiên Giao Dịch (Killzone Session)', points: 10 },
  { id: 'sl_safe', label: '6. Stop Loss An Toàn & Đủ Khoảng Cách', points: 10 },
  { id: 'rr_ratio', label: '7. Tỷ Lệ Risk : Reward Đạt Chuẩn (R:R >= 2:1)', points: 10 },
  { id: 'risk_mgmt', label: '8. Tâm Lý Kỷ Luật & Quản Lý Rủi Ro (0.5% - 1.0%)', points: 10 },
  { id: 'aa', label: '9. Không có tin tức đỏ tác động (High Impact News)', points: 10 },
  { id: 'bbbb', label: '10. Đủ năng lượng & tâm lý thoải mái trước lệnh', points: 5 },
];

export const DEFAULT_POST_MISTAKES: PostMistakeItem[] = [
  { id: 'fomo', label: 'FOMO (Vào sớm / Đuổi giá không chờ Retest)', penalty_points: -20 },
  { id: 'move_sl', label: 'Dời SL / Bỏ SL khi giá sắp chạm', penalty_points: -30 },
  { id: 'cut_early', label: 'Cắt Non (Thoát sớm trước kế hoạch TP)', penalty_points: -15, is_early_exit: true },
  { id: 'revenge', label: 'Revenge Trade (Vào lệnh cay cú gỡ lỗ)', penalty_points: -30 },
  { id: 'overlot', label: 'Overleveraged (Đi quá khối lượng quy định)', penalty_points: -25 },
  { id: 'overtrade', label: 'Overtrade (Vào quá nhiều lệnh cùng phiên)', penalty_points: -15 },
  { id: 'no_plan', label: 'Vào lệnh không có Kế hoạch / Setups rõ ràng', penalty_points: -20 },
];

export const DEFAULT_SETUP_TAGS: SetupTagItem[] = [
  { id: 'cuc_tri', label: 'Cực Trị' },
  { id: 'poi_sau_idm', label: 'POI sau IDM' },
  { id: 'sweep_idm', label: 'Sweep IDM' },
  { id: 'snr', label: 'SnR' },
  { id: 'ch_sub', label: 'Ch Sub' },
  { id: 'range_mct', label: 'Range MCT' },
  { id: 'candels', label: 'Candels' },
  { id: 'breaker_block', label: 'Breaker Block' },
  { id: 'fvg_retest', label: 'FVG Retest' },
];
