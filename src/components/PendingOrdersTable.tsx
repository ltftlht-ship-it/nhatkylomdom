import React, { useState } from 'react';
import { 
  PendingOrder, 
  TradingPlan 
} from '../types';
import { formatDateTimeWithOffset } from '../utils/tradeCalculations';
import { 
  Clock, 
  CheckCircle2, 
  Link2, 
  ArrowRight, 
  Zap, 
  Check, 
  AlertCircle,
  Tag,
  Trash2
} from 'lucide-react';

interface PendingOrdersTableProps {
  orders: PendingOrder[];
  plans: TradingPlan[];
  timezoneOffset?: number;
  onAssignPlan: (orderId: string, planId: string) => void;
  onExecuteOrder: (orderId: string) => void;
  onCancelOrder?: (orderId: string) => void;
}

export const PendingOrdersTable: React.FC<PendingOrdersTableProps> = ({
  orders,
  plans,
  timezoneOffset = 0,
  onAssignPlan,
  onExecuteOrder,
  onCancelOrder,
}) => {
  const [activePlanDropdown, setActivePlanDropdown] = useState<string | null>(null);

  const activeOrders = orders.filter(o => (o.status || '').toUpperCase() !== 'CANCELLED');

  return (
    <div className="flex flex-col h-full">
      {/* Pending Orders Notice & Tip Banner */}
      <div className="px-4 py-2.5 bg-blue-950/30 border-b border-blue-900/30 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span>
            Lệnh Limit cào tự động từ MT5. Người dùng <strong>1-Click gán Plan</strong> trước khi khớp.
            Khi khớp lệnh thành công, hệ thống tự động chuyển sang <strong>Bảng Lịch Sử</strong> và giữ nguyên Plan đã gán.
          </span>
        </div>
        <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
          {orders.length} lệnh chờ
        </span>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead>
            <tr className="bg-[#0f141d] border-b border-[#1e293b] text-slate-400 font-semibold tracking-wider text-[11px] uppercase">
              <th className="py-2.5 px-4">Mã Lệnh</th>
              <th className="py-2.5 px-3">Cặp Tiền</th>
              <th className="py-2.5 px-3">Loại Lệnh</th>
              <th className="py-2.5 px-3 text-right">Khối Lượng</th>
              <th className="py-2.5 px-3 text-right">Giá Đặt Limit</th>
              <th className="py-2.5 px-3 text-right">Stop Loss</th>
              <th className="py-2.5 px-3 text-right">Take Profit</th>
              <th className="py-2.5 px-3">Giờ Đặt</th>
              <th className="py-2.5 px-4">Kế Hoạch Gán (Plan)</th>
              <th className="py-2.5 px-4 text-center">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e293b]/60">
            {activeOrders.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>Không có lệnh chờ nào đang hoạt động</p>
                </td>
              </tr>
            ) : (
              activeOrders.map(order => {
                const assignedPlan = plans.find(p => p.id === order.plan_id);
                const isBuy = order.type === 'BUY';

                return (
                  <tr 
                    key={order.id} 
                    className="hover:bg-slate-800/30 transition-colors font-mono"
                  >
                    <td className="py-3 px-4 font-bold text-slate-200">
                      #{order.ticket}
                    </td>
                    <td className="py-3 px-3 font-sans font-bold text-white">
                      {order.symbol}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        isBuy 
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}>
                        {order.order_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-100">
                      {(order.volume ?? 0).toFixed(2)} Lot
                    </td>
                    <td className="py-3 px-3 text-right text-cyan-300 font-bold">
                      {order.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-right text-rose-400">
                      {order.sl > 0 ? order.sl.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-400">
                      {order.tp > 0 ? order.tp.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      {formatDateTimeWithOffset(order.placed_time, timezoneOffset, 'MM-DD HH:mm')}
                    </td>
                    <td className="py-3 px-4 font-sans relative">
                      {assignedPlan ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
                            <Tag className="w-3 h-3 text-cyan-400" />
                            {assignedPlan.code}: {assignedPlan.title.slice(0, 30)}...
                          </span>
                          <button
                            type="button"
                            onClick={() => setActivePlanDropdown(activePlanDropdown === order.id ? null : order.id)}
                            className="text-[10px] text-slate-400 hover:text-cyan-300 underline"
                          >
                            Đổi
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActivePlanDropdown(activePlanDropdown === order.id ? null : order.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>1-Click Gán Plan</span>
                        </button>
                      )}

                      {/* Dropdown Menu to Assign Plan */}
                      {activePlanDropdown === order.id && (
                        <div className="absolute z-30 left-4 top-10 w-72 bg-[#161c28] border border-slate-700 rounded-lg shadow-xl py-1 text-xs">
                          <div className="px-3 py-1.5 border-b border-slate-700/60 text-slate-400 font-bold uppercase text-[10px]">
                            Chọn Kế hoạch để liên kết
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {plans.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  onAssignPlan(order.id, p.id);
                                  setActivePlanDropdown(null);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-800/80 flex items-center justify-between text-slate-200 transition-colors"
                              >
                                <div>
                                  <span className="font-bold text-cyan-400 mr-1.5">{p.code}:</span>
                                  <span className="text-slate-300">{p.title}</span>
                                </div>
                                {order.plan_id === p.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onExecuteOrder(order.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer"
                          title="Mô phỏng khớp lệnh MT5 và chuyển sang Bảng Lịch Sử chính"
                        >
                          <Zap className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Khớp</span>
                        </button>

                        {onCancelOrder && (
                          <button
                            type="button"
                            onClick={() => onCancelOrder(order.id)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer"
                            title="Hủy lệnh chờ và cập nhật trạng thái CANCELLED trên Supabase"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>Hủy</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
