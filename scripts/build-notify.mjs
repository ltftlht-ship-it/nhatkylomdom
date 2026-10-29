// Đóng gói Edge Function "notify" thành 1 file duy nhất để dán / triển khai lên Supabase.
// Dùng chung công thức với Tab Báo Cáo (src/utils/*). Chạy: node scripts/build-notify.mjs
import { build } from 'esbuild';

// tradeCalculations chỉ cần hàm normalizeImageSource từ imageUtils; thay bằng bản rút gọn
// để không kéo theo code trình duyệt (localStorage, kết nối Supabase của app)
const stubImageUtils = {
  name: 'stub-image-utils',
  setup(b) {
    b.onResolve({ filter: /imageUtils$/ }, () => ({ path: 'imageUtils-stub', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: 'export function normalizeImageSource(s){ return s ? String(s).trim() : ""; }',
      loader: 'js',
    }));
  },
};

await build({
  entryPoints: ['supabase/functions/notify/index.ts'],
  outfile: 'supabase/functions/notify-bundle/index.ts',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  external: ['npm:*'],
  plugins: [stubImageUtils],
  banner: { js: '// @ts-nocheck\n// FILE TỰ SINH từ supabase/functions/notify/index.ts — không sửa tay. Chạy: node scripts/build-notify.mjs' },
  logLevel: 'info',
});
