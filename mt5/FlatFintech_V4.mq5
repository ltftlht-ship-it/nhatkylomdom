//+------------------------------------------------------------------+
//|                                                FlatFintech_V4.mq5|
//|                                      Copyright 2026, Flat Fintech|
//+------------------------------------------------------------------+
#property copyright "Flat Fintech Trading Journal"
#property link      "https://supabase.com"
#property version   "4.00"
#property strict

// --- INPUT PARAMETERS ---
input string   InpSupabaseUrl          = "https://fvwcanltqxeorfgemxel.supabase.co"; 
input string   InpSupabaseAnonKey      = "sb_publishable_efpIfGXCsFX8Jsnwo6fINA__gXHU5ut";
// Mật mã EA do Admin cấp (bảng ea_keys trên Supabase). Thiếu mật mã thì EA không gửi được lệnh.
input string   InpEaSecret             = "";

string g_account_id;

//+------------------------------------------------------------------+
//| CÁC HÀM BỔ SUNG ĐỂ TÍNH TOÁN MAE, MFE, SL/TP                      |
//+------------------------------------------------------------------+

// Lấy Initial SL
double getInitialSL(ulong position_id) {
   double val = 0.0;
   if(HistorySelectByPosition(position_id)) {
      int totalOrders = HistoryOrdersTotal();
      for(int i = 0; i < totalOrders; i++) {
         ulong orderTicket = HistoryOrderGetTicket(i);
         double initial_sl = HistoryOrderGetDouble(orderTicket, ORDER_SL);
         if(initial_sl > 0) { val = initial_sl; break; }
      }
   }
   HistorySelect(0, TimeCurrent());
   return val;
}

// Lấy Initial TP
double getInitialTP(ulong position_id) {
   double val = 0.0;
   if(HistorySelectByPosition(position_id)) {
      int totalOrders = HistoryOrdersTotal();
      for(int i = 0; i < totalOrders; i++) {
         ulong orderTicket = HistoryOrderGetTicket(i);
         double initial_tp = HistoryOrderGetDouble(orderTicket, ORDER_TP);
         if(initial_tp > 0) { val = initial_tp; break; }
      }
   }
   HistorySelect(0, TimeCurrent());
   return val;
}

// Đếm số lần dời SL
int GetSLChangeCount(ulong position_id) {
    int count = 0;
    double last_sl = -1.0;
    if(HistorySelectByPosition(position_id)) {
        int totalOrders = HistoryOrdersTotal();
        for(int i = 0; i < totalOrders; i++) {
            ulong orderTicket = HistoryOrderGetTicket(i);
            double current_sl = HistoryOrderGetDouble(orderTicket, ORDER_SL);
            if(last_sl == -1.0 && current_sl > 0) {
                last_sl = current_sl; 
            } else if(current_sl != last_sl && current_sl > 0 && last_sl > 0) {
                count++;
                last_sl = current_sl;
            }
        }
    }
    HistorySelect(0, TimeCurrent());
    return count;
}

// Tính toán MAE & MFE
void CalculateMaeMfe(string sym, datetime t_open, datetime t_close, long d_type, double &mae, double &mfe) {
    mae = 0.0; mfe = 0.0;
    MqlRates rates[];
    ArraySetAsSeries(rates, true);
    // Quét nến M1 từ lúc mở đến lúc đóng lệnh (+60s bù trừ)
    int copied = CopyRates(sym, PERIOD_M1, t_open, t_close + 60, rates);
    if(copied > 0) {
        double highest = rates[0].high;
        double lowest = rates[0].low;
        for(int i=1; i<copied; i++) {
            if(rates[i].high > highest) highest = rates[i].high;
            if(rates[i].low < lowest) lowest = rates[i].low;
        }
        if(d_type == DEAL_TYPE_BUY) {
            mae = lowest;
            mfe = highest;
        } else if(d_type == DEAL_TYPE_SELL) {
            mae = highest;
            mfe = lowest;
        }
    }
}

//+------------------------------------------------------------------+
//| GOM DỮ LIỆU NẾN M5 TỪ OPEN ĐẾN CLOSE THÀNH JSON                  |
//+------------------------------------------------------------------+
string GetTradeCandlesJson(string sym, datetime t_open, datetime t_close)
  {
   if(t_close <= t_open) t_close = t_open + 300;
   MqlRates rates[];
   ArraySetAsSeries(rates, false); // Thời gian tăng dần
   
   // Quét nến M5 từ mở đến đóng lệnh (+-300s bù trừ một cây nến)
   int copied = CopyRates(sym, PERIOD_M5, t_open - 300, t_close + 300, rates);
   if(copied <= 0) return "[]";
   
   // Giới hạn tối đa 300 nến M5 để payload gọn nhẹ
   int max_bars = (copied > 300 ? 300 : copied);
   int start_idx = (copied > 300 ? copied - 300 : 0);
   
   string json = "[";
   for(int i = start_idx; i < copied; i++)
     {
      if(i > start_idx) json += ",";
      json += StringFormat(
         "{\"time\":%I64d,\"open\":%s,\"high\":%s,\"low\":%s,\"close\":%s}",
         (long)rates[i].time,
         DoubleToString(rates[i].open, 5),
         DoubleToString(rates[i].high, 5),
         DoubleToString(rates[i].low, 5),
         DoubleToString(rates[i].close, 5)
      );
     }
   json += "]";
   return json;
  }

//+------------------------------------------------------------------+
//| Khởi tạo EA                                                      |
//+------------------------------------------------------------------+
int OnInit()
  {
   FolderCreate("TradeImages");
   g_account_id = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   PrintFormat("[EA V4.00] Khoi chay cho Account: %s", g_account_id);
   if(StringLen(InpEaSecret) == 0)
     {
      Alert("[EA V4.00] Chua nhap InpEaSecret (mat ma EA). Vao tab Inputs cua EA de nhap.");
      return(INIT_PARAMETERS_INCORRECT);
     }
   
   EventSetTimer(2);
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

void OnTimer()
  {
   EventKillTimer();
   Print("[EA V4.00] Bat dau quet Lich su & Lenh Limit Live...");
   SyncHistoricalDeals(); 
   SyncActivePendingOrders();
  }

//+------------------------------------------------------------------+
//| BẮT SỰ KIỆN REAL-TIME (LIMIT, OPEN & CLOSE TRADES)               |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                         const MqlTradeRequest& request,
                         const MqlTradeResult& result)
  {
   // 1. LỆNH LIMIT MỚI ĐẶT REALTIME
   if(trans.type == TRADE_TRANSACTION_ORDER_ADD)
     {
      ulong order_ticket = trans.order;
      if(OrderSelect(order_ticket))
        {
         ENUM_ORDER_TYPE o_type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
         if(o_type == ORDER_TYPE_BUY_LIMIT || o_type == ORDER_TYPE_SELL_LIMIT)
           {
            SendLimitOrderToWeb(order_ticket, o_type, "PENDING_PLAN");
           }
        }
     }

   // 2. LỆNH LIMIT BỊ HỦY / XÓA REALTIME (CANCELED / EXPIRED)
   if(trans.type == TRADE_TRANSACTION_ORDER_DELETE)
     {
      ulong order_ticket = trans.order;
      // CHỈ đánh dấu CANCELED khi lệnh thực sự bị hủy bởi trader hoặc hết hạn
      // TUYỆT ĐỐI KHÔNG đánh dấu CANCELED khi lệnh ĐÃ KHỚP (ORDER_STATE_FILLED / ORDER_STATE_PARTIAL)
      if(trans.order_state == ORDER_STATE_CANCELED || 
         trans.order_state == ORDER_STATE_EXPIRED || 
         trans.order_state == ORDER_STATE_REJECTED)
        {
         UpdateOrderStatusToWeb(order_ticket, "CANCELED");
        }
     }

   // 3. XỬ LÝ KHỚP LỆNH (DEAL_ENTRY_IN) VÀ ĐÓNG LỆNH (DEAL_ENTRY_OUT / INOUT)
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
     {
      ulong deal_ticket = trans.deal;
      if(HistoryDealSelect(deal_ticket))
        {
         long deal_entry = HistoryDealGetInteger(deal_ticket, DEAL_ENTRY);
         
         // 3.1. LỆNH VỪA KHỚP / VÀO LỆNH (ENTRY_IN) => ĐẨY TRẠNG THÁI "OPEN"
         if(deal_entry == DEAL_ENTRY_IN)
           {
            SendOpenDealToWeb(deal_ticket);
           }
         // 3.2. LỆNH VỪA ĐÓNG (ENTRY_OUT HOẶC ENTRY_INOUT) => GỬI FULL DATA CLOSED KÈM ẢNH
         else if(deal_entry == DEAL_ENTRY_OUT || deal_entry == DEAL_ENTRY_INOUT)
           {
            SendClosedDealToWeb(deal_ticket);
           }
        }
     }
  }

//+------------------------------------------------------------------+
//| CHỤP ẢNH CHART BASE64                                            |
//+------------------------------------------------------------------+
string CaptureChartBase64(ulong ticket)
  {
   string filename = StringFormat("TradeImages\\%I64u.png", ticket);
   
   // Chụp độ phân giải 1024x576 sắc nét và nhẹ (~30KB)
   if(!ChartScreenShot(0, filename, 1024, 576, ALIGN_RIGHT))
     {
      return "";
     }
   
   int file_handle = FileOpen(filename, FILE_READ|FILE_BIN);
   if(file_handle == INVALID_HANDLE) return "";
   
   ulong file_size = FileSize(file_handle);
   if(file_size == 0)
     {
      FileClose(file_handle);
      return "";
     }
     
   uchar image_data[];
   ArrayResize(image_data, (int)file_size);
   FileReadArray(file_handle, image_data, 0, (int)file_size);
   FileClose(file_handle);
   
   string base64_str = "";
   uchar key[];
   uchar base64_data[];
   // Dùng mảng base64_data riêng biệt để không bị overwrite làm hỏng file PNG
   int encoded_len = CryptEncode(CRYPT_BASE64, image_data, key, base64_data);
   if(encoded_len > 0)
     {
      base64_str = CharArrayToString(base64_data, 0, encoded_len, CP_UTF8);
     }
   
   return base64_str;
  }

//+------------------------------------------------------------------+
//| QUÉT CÁC LỆNH LIMIT ĐANG CHỜ TRÊN CHART                          |
//+------------------------------------------------------------------+
void SyncActivePendingOrders()
  {
   int total_orders = OrdersTotal();
   if(total_orders == 0) return;
   
   string json_body = "[";
   int count = 0;
   
   for(int i = 0; i < total_orders; i++)
     {
      ulong order_ticket = OrderGetTicket(i);
      if(order_ticket > 0)
        {
         ENUM_ORDER_TYPE o_type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
         if(o_type == ORDER_TYPE_BUY_LIMIT || o_type == ORDER_TYPE_SELL_LIMIT)
           {
            if(count > 0) json_body += ",";
            
            string symbol   = OrderGetString(ORDER_SYMBOL);
            double price    = OrderGetDouble(ORDER_PRICE_OPEN);
            double volume   = OrderGetDouble(ORDER_VOLUME_INITIAL);
            datetime time_o = (datetime)OrderGetInteger(ORDER_TIME_SETUP);
            
            json_body += StringFormat(
               "{\"account_id\":\"%s\",\"ticket\":%I64u,\"symbol\":\"%s\",\"type\":\"%s\",\"volume\":%s,\"open_price\":%s,\"status\":\"PENDING_PLAN\",\"open_time\":\"%s\"}",
               g_account_id, order_ticket, symbol, 
               (o_type == ORDER_TYPE_BUY_LIMIT ? "BUY_LIMIT" : "SELL_LIMIT"),
               DoubleToString(volume, 2), DoubleToString(price, 5), TimeToString(time_o, TIME_DATE|TIME_SECONDS)
            );
            count++;
           }
        }
     }
   json_body += "]";
   
   if(count > 0) PrintFormat("[EA] Da gui toan bo %d lenh lich su kem nen M5 len Supabase!", count);
  }

//+------------------------------------------------------------------+
//| GỬI LỆNH LIMIT SINGLE REALTIME                                  |
//+------------------------------------------------------------------+
void SendLimitOrderToWeb(ulong ticket, ENUM_ORDER_TYPE o_type, string status)
  {
   string img_base64 = CaptureChartBase64(ticket);
   string symbol = OrderGetString(ORDER_SYMBOL);
   double price = OrderGetDouble(ORDER_PRICE_OPEN);
   double volume = OrderGetDouble(ORDER_VOLUME_INITIAL);
   datetime time_o = (datetime)OrderGetInteger(ORDER_TIME_SETUP);
   
   string json = StringFormat(
      "{"
      "\"account_id\":\"%s\","
      "\"ticket\":%I64u,"
      "\"symbol\":\"%s\","
      "\"type\":\"%s\","
      "\"volume\":%s,"
      "\"open_price\":%s,"
      "\"status\":\"%s\","
      "\"open_time\":\"%s\"",
      g_account_id, ticket, symbol,
      (o_type == ORDER_TYPE_BUY_LIMIT ? "BUY_LIMIT" : "SELL_LIMIT"),
      DoubleToString(volume, 2), DoubleToString(price, 5), status,
      TimeToString(time_o, TIME_DATE|TIME_SECONDS)
   );
   // Box 1 để trống cho Pre-Trade Plan mapping
   json += "}";
   
   PostHttpToSupabase(json);
  }

//+------------------------------------------------------------------+
//| GỬI LỆNH VỪA KHỚP / VÀO LỆNH THỊ TRƯỜNG REALTIME (STATUS = OPEN) |
//+------------------------------------------------------------------+
void SendOpenDealToWeb(ulong deal_ticket)
  {
   ulong position_id  = HistoryDealGetInteger(deal_ticket, DEAL_POSITION_ID);
   ulong order_ticket = HistoryDealGetInteger(deal_ticket, DEAL_ORDER);
   string symbol      = HistoryDealGetString(deal_ticket, DEAL_SYMBOL);
   long deal_type     = HistoryDealGetInteger(deal_ticket, DEAL_TYPE);
   double volume      = HistoryDealGetDouble(deal_ticket, DEAL_VOLUME);
   double open_price  = HistoryDealGetDouble(deal_ticket, DEAL_PRICE);
   datetime time_o    = (datetime)HistoryDealGetInteger(deal_ticket, DEAL_TIME);
   
   string type_str = (deal_type == DEAL_TYPE_BUY ? "BUY" : "SELL");
   
   double open_sl = getInitialSL(position_id);
   double open_tp = getInitialTP(position_id);
   
   // 1. Nếu lệnh xuất phát từ Limit Order đã có trên web:
   if(order_ticket > 0)
     {
      UpdateOrderStatusToWeb(order_ticket, "OPEN");
     }
   
   // 2. Đồng thời upsert bản ghi vị thế OPEN lên Supabase
   ulong ticket_to_send = (order_ticket > 0 ? order_ticket : deal_ticket);
   
   string json = StringFormat(
      "{"
      "\"account_id\":\"%s\","
      "\"ticket\":%I64u,"
      "\"position_id\":%I64u,"
      "\"symbol\":\"%s\","
      "\"type\":\"%s\","
      "\"volume\":%s,"
      "\"open_price\":%s,"
      "\"status\":\"OPEN\","
      "\"open_time\":\"%s\","
      "\"initial_sl\":%s,"
      "\"initial_tp\":%s"
      "}",
      g_account_id, ticket_to_send, position_id, symbol,
      type_str,
      DoubleToString(volume, 2),
      DoubleToString(open_price, 5),
      TimeToString(time_o, TIME_DATE|TIME_SECONDS),
      DoubleToString(open_sl, 5),
      DoubleToString(open_tp, 5)
   );
   
   PrintFormat("[EA] Lenh da khop! Dang day trang thai OPEN cho Ticket %I64u (Position %I64u)...", ticket_to_send, position_id);
   PostHttpToSupabase(json);
  }

//+------------------------------------------------------------------+
//| GỬI LỆNH VỪA ĐÓNG REALTIME                                       |
//+------------------------------------------------------------------+
void SendClosedDealToWeb(ulong deal_ticket)
  {
   ulong position_id = HistoryDealGetInteger(deal_ticket, DEAL_POSITION_ID);
   
   // CHỈ CHỤP ẢNH KHI VỊ THẾ ĐÃ ĐÓNG HOÀN TOÀN (Remaining volume == 0)
   // Khi cắt từng phần (partial close), không chụp ảnh cho đến khi toàn bộ khối lượng kết thúc.
   string img_base64 = "";
   bool is_position_fully_closed = true;
   if(position_id > 0)
     {
      if(PositionSelectByTicket(position_id))
        {
         double rem_vol = PositionGetDouble(POSITION_VOLUME);
         if(rem_vol > 0.00001)
           {
            is_position_fully_closed = false;
           }
        }
     }
   
   if(is_position_fully_closed)
     {
      img_base64 = CaptureChartBase64(deal_ticket);
     }
   string symbol     = HistoryDealGetString(deal_ticket, DEAL_SYMBOL);
   long out_deal_type= HistoryDealGetInteger(deal_ticket, DEAL_TYPE);
   double volume     = HistoryDealGetDouble(deal_ticket, DEAL_VOLUME);
   double close_price= HistoryDealGetDouble(deal_ticket, DEAL_PRICE);
   double pnl        = HistoryDealGetDouble(deal_ticket, DEAL_PROFIT);
   double comm       = HistoryDealGetDouble(deal_ticket, DEAL_COMMISSION);
   double swap       = HistoryDealGetDouble(deal_ticket, DEAL_SWAP);
   datetime time_c   = (datetime)HistoryDealGetInteger(deal_ticket, DEAL_TIME);
   double balance    = AccountInfoDouble(ACCOUNT_BALANCE);
   
   datetime time_o = time_c; 
   double open_price = close_price;
   long pos_type = -1;
   ulong in_order_ticket = 0;

   if(position_id > 0 && HistorySelectByPosition(position_id)) {
      int pos_deals = HistoryDealsTotal();
      for(int j = 0; j < pos_deals; j++) {
         ulong in_deal = HistoryDealGetTicket(j);
         if(in_deal > 0 && HistoryDealGetInteger(in_deal, DEAL_ENTRY) == DEAL_ENTRY_IN) {
            time_o = (datetime)HistoryDealGetInteger(in_deal, DEAL_TIME);
            open_price = HistoryDealGetDouble(in_deal, DEAL_PRICE);
            pos_type = HistoryDealGetInteger(in_deal, DEAL_TYPE);
            in_order_ticket = HistoryDealGetInteger(in_deal, DEAL_ORDER);
            break;
         }
      }
   }
   HistorySelect(0, TimeCurrent());

   // Với deal OUT đóng vị thế, hướng deal luôn ngược lại với vị thế gốc:
   // Deal OUT BUY => Vị thế ban đầu là SELL
   // Deal OUT SELL => Vị thế ban đầu là BUY
   if(pos_type == -1) {
      if(out_deal_type == DEAL_TYPE_BUY) pos_type = DEAL_TYPE_SELL;
      else if(out_deal_type == DEAL_TYPE_SELL) pos_type = DEAL_TYPE_BUY;
   }

   double open_sl = getInitialSL(position_id);
   double open_tp = getInitialTP(position_id);
   int sl_count = GetSLChangeCount(position_id);
   int duration = (int)(time_c - time_o);
   
   double mae = 0.0, mfe = 0.0;
   CalculateMaeMfe(symbol, time_o, time_c, pos_type, mae, mfe);
   string candles_json = GetTradeCandlesJson(symbol, time_o, time_c);

   string json = StringFormat(
      "{"
      "\"account_id\":\"%s\","
      "\"ticket\":%I64u,"
      "\"position_id\":%I64u,"
      "\"symbol\":\"%s\","
      "\"type\":\"%s\","
      "\"volume\":%s,"
      "\"open_price\":%s,"
      "\"close_price\":%s,"
      "\"pnl\":%s,"
      "\"commission\":%s,"
      "\"swap\":%s,"
      "\"current_balance\":%s,"
      "\"open_time\":\"%s\","
      "\"close_time\":\"%s\","
      "\"status\":\"CLOSED\","
      "\"initial_sl\":%s,"
      "\"initial_tp\":%s,"
      "\"mae_price\":%s,"
      "\"mfe_price\":%s,"
      "\"sl_change_count\":%d,"
      "\"duration_seconds\":%d",
      g_account_id, deal_ticket, position_id, symbol,
      (pos_type == DEAL_TYPE_BUY ? "BUY" : "SELL"),
      DoubleToString(volume, 2),
      DoubleToString(open_price, 5),
      DoubleToString(close_price, 5),
      DoubleToString(pnl, 2), DoubleToString(comm, 2), DoubleToString(swap, 2),
      DoubleToString(balance, 2),
      TimeToString(time_o, TIME_DATE|TIME_SECONDS),
      TimeToString(time_c, TIME_DATE|TIME_SECONDS),
      DoubleToString(open_sl, 5), DoubleToString(open_tp, 5),
      DoubleToString(mae, 5), DoubleToString(mfe, 5),
      sl_count, duration
   );
   // Sử dụng đúng cột image_url_1 chuẩn của Supabase trades
   if(StringLen(img_base64) > 0)
     {
      json += ",\"image_url_1\":\"data:image/png;base64," + img_base64 + "\"";
     }
   json += ",\"candles\":" + candles_json;
   json += "}";
   
   PrintFormat("[EA] Dang day lenh CLOSED Ticket %I64u len Supabase...", deal_ticket);
   PostHttpToSupabase(json);

   // Nếu lệnh này xuất phát từ Limit order trước đó, cập nhật pending order thành CLOSED
   if(in_order_ticket > 0 && in_order_ticket != deal_ticket)
     {
      UpdateOrderStatusToWeb(in_order_ticket, "CLOSED");
     }
  }

//+------------------------------------------------------------------+
//| QUÉT LỊCH SỬ CŨ ĐẦY ĐỦ 100% THÔNG TIN                            |
//+------------------------------------------------------------------+
//| QUÉT LỊCH SỬ CŨ ĐẦY ĐỦ 100% THÔNG TIN KÈM NẾN M5                 |
//+------------------------------------------------------------------+
void SyncHistoricalDeals()
  {
   if(!HistorySelect(0, TimeCurrent())) return;
   
   int total_deals = HistoryDealsTotal();
   double current_bal = AccountInfoDouble(ACCOUNT_BALANCE);
   double initial_bal = 0.0;
   
   for(int k = 0; k < total_deals; k++)
     {
      ulong t = HistoryDealGetTicket(k);
      if(t > 0)
        {
         long deal_type = HistoryDealGetInteger(t, DEAL_TYPE);
         double profit  = HistoryDealGetDouble(t, DEAL_PROFIT);
         if(deal_type == DEAL_TYPE_BALANCE && profit > 0)
           {
            initial_bal = profit; 
            break; 
           }
        }
     }
   if(initial_bal == 0.0) initial_bal = current_bal;

   int count = 0;
   
   for(int i = 0; i < total_deals; i++)
     {
      HistorySelect(0, TimeCurrent());
      ulong deal_ticket = HistoryDealGetTicket(i);
      
      if(deal_ticket > 0)
        {
         long deal_entry = HistoryDealGetInteger(deal_ticket, DEAL_ENTRY);
         
         if(deal_entry == DEAL_ENTRY_OUT || deal_entry == DEAL_ENTRY_INOUT)
           {
            ulong position_id = HistoryDealGetInteger(deal_ticket, DEAL_POSITION_ID);
            string symbol     = HistoryDealGetString(deal_ticket, DEAL_SYMBOL);
            double pnl        = HistoryDealGetDouble(deal_ticket, DEAL_PROFIT);
            double comm       = HistoryDealGetDouble(deal_ticket, DEAL_COMMISSION);
            double swap       = HistoryDealGetDouble(deal_ticket, DEAL_SWAP);
            double volume     = HistoryDealGetDouble(deal_ticket, DEAL_VOLUME);
            double close_p    = HistoryDealGetDouble(deal_ticket, DEAL_PRICE);
            long out_deal_type= HistoryDealGetInteger(deal_ticket, DEAL_TYPE);
            datetime close_t  = (datetime)HistoryDealGetInteger(deal_ticket, DEAL_TIME);
            
            double open_p     = close_p;
            datetime open_t   = close_t;
            long pos_type     = -1;
            
            if(position_id > 0 && HistorySelectByPosition(position_id))
              {
               int pos_deals = HistoryDealsTotal();
               for(int j = 0; j < pos_deals; j++)
                 {
                  ulong in_deal = HistoryDealGetTicket(j);
                  if(in_deal > 0 && HistoryDealGetInteger(in_deal, DEAL_ENTRY) == DEAL_ENTRY_IN)
                    {
                     open_p = HistoryDealGetDouble(in_deal, DEAL_PRICE);
                     open_t = (datetime)HistoryDealGetInteger(in_deal, DEAL_TIME);
                     pos_type = HistoryDealGetInteger(in_deal, DEAL_TYPE);
                     break;
                    }
                 }
               HistorySelect(0, TimeCurrent());
              }
            
            if(pos_type == -1)
              {
               if(out_deal_type == DEAL_TYPE_BUY) pos_type = DEAL_TYPE_SELL;
               else if(out_deal_type == DEAL_TYPE_SELL) pos_type = DEAL_TYPE_BUY;
              }
            
            double open_sl = getInitialSL(position_id);
            double open_tp = getInitialTP(position_id);
            int sl_count   = GetSLChangeCount(position_id);
            
            HistorySelect(0, TimeCurrent());
            
            int duration = (int)(close_t - open_t);
            double mae = 0.0, mfe = 0.0;
            CalculateMaeMfe(symbol, open_t, close_t, pos_type, mae, mfe);
            string candles_hist_json = GetTradeCandlesJson(symbol, open_t, close_t);
            
            string deal_json = StringFormat(
               "{"
               "\"account_id\":\"%s\","
               "\"ticket\":%I64u,"
               "\"position_id\":%I64u,"
               "\"symbol\":\"%s\","
               "\"type\":\"%s\","
               "\"volume\":%s,"
               "\"open_price\":%s,"
               "\"close_price\":%s,"
               "\"pnl\":%s,"
               "\"commission\":%s,"
               "\"swap\":%s,"
               "\"initial_balance\":%s,"
               "\"current_balance\":%s,"
               "\"open_time\":\"%s\","
               "\"close_time\":\"%s\","
               "\"status\":\"CLOSED\","
               "\"initial_sl\":%s,"
               "\"initial_tp\":%s,"
               "\"mae_price\":%s,"
               "\"mfe_price\":%s,"
               "\"sl_change_count\":%d,"
               "\"duration_seconds\":%d",
               g_account_id, deal_ticket, position_id, symbol, 
               (pos_type == DEAL_TYPE_BUY ? "BUY" : "SELL"), 
               DoubleToString(volume, 2), 
               DoubleToString(open_p, 5), 
               DoubleToString(close_p, 5), 
               DoubleToString(pnl, 2), 
               DoubleToString(comm, 2), 
               DoubleToString(swap, 2), 
               DoubleToString(initial_bal, 2), 
               DoubleToString(current_bal, 2), 
               TimeToString(open_t, TIME_DATE|TIME_SECONDS), 
               TimeToString(close_t, TIME_DATE|TIME_SECONDS), 
               DoubleToString(open_sl, 5), 
               DoubleToString(open_tp, 5), 
               DoubleToString(mae, 5), 
               DoubleToString(mfe, 5), 
               sl_count, 
               duration
            );
            
            if(StringLen(candles_hist_json) > 0)
              {
               deal_json += ",\"candles\":" + candles_hist_json;
              }
            deal_json += "}";
            
            PostHttpToSupabase(deal_json);
            count++;
           }
        }
     }
   
   if(count > 0) 
     {
      PrintFormat("[EA] Da dong bo xong %d lenh lich su kem nen M5 len Supabase!", count);
     }
  }

//+------------------------------------------------------------------+
//| ĐỒNG BỘ CÁC LỆNH LIMIT ĐÃ HỦY TỪ LỊCH SỬ SANG SUPABASE          |
//+------------------------------------------------------------------+
void SyncHistoricalCancelledOrders()
  {
   if(!HistorySelect(0, TimeCurrent())) return;
   int total_orders = HistoryOrdersTotal();
   int scan_limit = (total_orders > 150 ? total_orders - 150 : 0);
   int count = 0;
   
   for(int i = total_orders - 1; i >= scan_limit; i--)
     {
      ulong order_ticket = HistoryOrderGetTicket(i);
      if(order_ticket > 0)
        {
         ENUM_ORDER_STATE o_state = (ENUM_ORDER_STATE)HistoryOrderGetInteger(order_ticket, ORDER_STATE);
         ENUM_ORDER_TYPE o_type = (ENUM_ORDER_TYPE)HistoryOrderGetInteger(order_ticket, ORDER_TYPE);
         if(o_type == ORDER_TYPE_BUY_LIMIT || o_type == ORDER_TYPE_SELL_LIMIT ||
            o_type == ORDER_TYPE_BUY_STOP || o_type == ORDER_TYPE_SELL_STOP)
           {
            if(o_state == ORDER_STATE_CANCELED || o_state == ORDER_STATE_EXPIRED || o_state == ORDER_STATE_REJECTED)
              {
               UpdateOrderStatusToWeb(order_ticket, "CANCELED");
               count++;
              }
           }
        }
     }
   if(count > 0)
     {
      PrintFormat("[EA] Da kiem tra va dong bo trang thai %d lenh Limit da huy len Supabase!", count);
     }
  }

//+------------------------------------------------------------------+
//| GỌI CỔNG RIÊNG CỦA EA TRÊN SUPABASE (rpc/<fn_name>)               |
//| Supabase kiểm tra mật mã EA rồi mới ghi vào bảng trades           |
//+------------------------------------------------------------------+
int CallSupabaseRpc(string fn_name, string body)
  {
   string headers = "Content-Type: application/json\r\n";
   headers += "apikey: " + InpSupabaseAnonKey + "\r\n";
   headers += "Authorization: Bearer " + InpSupabaseAnonKey + "\r\n";

   char post_data[];
   char result[];
   string result_headers;

   StringToCharArray(body, post_data, 0, WHOLE_ARRAY, CP_UTF8);
   if(ArraySize(post_data) > 0) ArrayResize(post_data, ArraySize(post_data) - 1);

   string url = InpSupabaseUrl + "/rest/v1/rpc/" + fn_name;

   ResetLastError();
   int res = WebRequest("POST", url, headers, 10000, post_data, result, result_headers);
   if(res < 200 || res >= 300)
     {
      PrintFormat("[EA] %s that bai (%d): %s", fn_name, res, CharArrayToString(result));
     }
   return res;
  }

//+------------------------------------------------------------------+
//| GỬI 1 LỆNH LÊN SUPABASE (ghi mới hoặc cập nhật theo account_id + ticket) |
//+------------------------------------------------------------------+
void PostHttpToSupabase(string json_payload)
  {
   string body = "{\"p_secret\":\"" + InpEaSecret + "\",\"p_row\":" + json_payload + "}";
   int res = CallSupabaseRpc("ea_upsert_trade", body);
   if(res >= 200 && res < 300) Print("[EA] Day du lieu len Supabase thanh cong!");
  }

//+------------------------------------------------------------------+
//| CẬP NHẬT TRẠNG THÁI LỆNH (OPEN / CANCELED / CLOSED) TRONG ĐÚNG TÀI KHOẢN |
//+------------------------------------------------------------------+
void UpdateOrderStatusToWeb(ulong ticket, string status)
  {
   string body = StringFormat(
      "{\"p_secret\":\"%s\",\"p_account_id\":\"%s\",\"p_ticket\":\"%I64u\",\"p_status\":\"%s\"}",
      InpEaSecret, g_account_id, ticket, status
   );
   CallSupabaseRpc("ea_update_status", body);
  }
//+------------------------------------------------------------------+
