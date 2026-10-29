import { getSupabaseClient } from '../lib/supabase';

/**
 * Kiểm tra xem một chuỗi có phải là Data URL base64 hay không
 */
export function isBase64DataUrl(str?: string | null): boolean {
  if (!str) return false;
  return str.startsWith('data:image/') || str.startsWith('data:application/');
}

/**
 * Nén và resize ảnh trước khi lưu/upload:
 * - Giới hạn cạnh dài tối đa 1280 - 1600px (mặc định 1600px).
 * - Chuyển sang định dạng WebP (hoặc JPEG nếu trình duyệt không hỗ trợ WebP)
 * - Quality 75% - 80% (mặc định 0.78).
 * - Giảm dung lượng từ vài MB xuống còn ~80-250KB, giữ độ sắc nét biểu đồ.
 */
export async function compressImage(
  fileOrBlob: Blob | File,
  maxWidth: number = 1600,
  quality: number = 0.78
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Không thể tải dữ liệu ảnh'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Tính tỉ lệ thu nhỏ nếu kích thước vượt quá maxWidth
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Không thể khởi tạo Canvas 2D'));
          return;
        }

        // Vẽ ảnh lên canvas với smooth rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Thử export WebP trước, nếu không hỗ trợ thì fallback sang JPEG
        let mimeType = 'image/webp';
        let dataUrl = canvas.toDataURL(mimeType, quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          mimeType = 'image/jpeg';
          dataUrl = canvas.toDataURL(mimeType, quality);
        }

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              // Fallback nếu toBlob trả về null
              resolve({ blob: fileOrBlob, dataUrl });
            }
          },
          mimeType,
          quality
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(fileOrBlob);
  });
}

/**
 * KHO ẢNH NHẬT KÝ RIÊNG TƯ (bucket 'journal', xem supabase/journal_storage.sql)
 * Ảnh lưu trong thư mục mang id người dùng; trong cơ sở dữ liệu chỉ lưu tham chiếu "sb://journal/<đường dẫn>".
 * Khi hiển thị mới xin link tạm (hết hạn sau 1 giờ), người khác không mở được.
 */
const JOURNAL_BUCKET = 'journal';
const REF_PREFIX = `sb://${JOURNAL_BUCKET}/`;

export const isJournalRef = (s?: string | null) => Boolean(s && s.startsWith(REF_PREFIX));

/** Tải ảnh lên kho riêng tư. Trả về tham chiếu sb://... hoặc null nếu lỗi / chưa đăng nhập. */
export async function uploadImageToSupabaseStorage(blob: Blob, _fileName?: string): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client?.storage) return null;
  try {
    const { data: { session } } = await client.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return null;
    const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/png' ? 'png' : 'webp';
    const path = `${uid}/${crypto.randomUUID()}.${ext}`;
    const { error } = await client.storage.from(JOURNAL_BUCKET).upload(path, blob, {
      contentType: blob.type || 'image/webp',
      upsert: false,
    });
    if (error) {
      console.warn('[Storage] Không tải được ảnh lên kho riêng tư:', error.message);
      return null;
    }
    return REF_PREFIX + path;
  } catch (err: any) {
    console.warn('[Storage] Ngoại lệ khi tải ảnh:', err?.message || err);
    return null;
  }
}

/** Ảnh dạng base64 (dán / chọn file) -> tải lên kho riêng tư, trả về tham chiếu sb://... */
export async function uploadDataUrlToStorage(dataUrl: string): Promise<string | null> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    return await uploadImageToSupabaseStorage(blob);
  } catch {
    return null;
  }
}

const signedCache = new Map<string, { url: string; exp: number }>();

/** Đổi tham chiếu sb://... thành link xem tạm; ảnh dạng khác giữ nguyên */
export async function resolveImageRef(src?: string | null): Promise<string> {
  if (!src) return '';
  if (!isJournalRef(src)) return normalizeImageSource(src);
  const hit = signedCache.get(src);
  if (hit && hit.exp > Date.now()) return hit.url;
  const client = getSupabaseClient();
  if (!client) return '';
  const { data, error } = await client.storage.from(JOURNAL_BUCKET).createSignedUrl(src.slice(REF_PREFIX.length), 3600);
  if (error || !data?.signedUrl) return '';
  signedCache.set(src, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

/**
 * Chuẩn hóa chuỗi ảnh: nếu chuỗi là raw base64 (chưa có data:image/...;base64,) thì tự động gắn prefix
 */
export function normalizeImageSource(img?: string | null): string {
  if (!img) return '';
  const trimmed = String(img).trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('data:application/') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  // Nếu là chuỗi base64 raw (bắt đầu bằng iVBORw0KGgo hoặc ký tự base64)
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed.slice(0, 50))) {
    return `data:image/png;base64,${trimmed}`;
  }
  return trimmed;
}

/**
 * Chụp màn hình (Screen/Tab Capture) trực tiếp từ trình duyệt:
 * Người dùng xác nhận chia sẻ Tab hiện tại, hệ thống lập tức bắt 1 khung hình biểu đồ sắc nét và chuyển thành DataURL.
 */
export async function captureScreenFrame(): Promise<string | null> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    throw new Error('Trình duyệt hiện tại không hỗ trợ API chụp màn hình trực tiếp.');
  }

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      displaySurface: 'browser',
    },
    audio: false,
  });

  try {
    const track = stream.getVideoTracks()[0];
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();

    // Chờ 150ms để render chuẩn xác frame
    await new Promise((r) => setTimeout(r, 150));

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Không thể khởi tạo Canvas chụp ảnh');
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Tắt stream ngay sau khi chụp
    track.stop();
    stream.getTracks().forEach((t) => t.stop());

    return canvas.toDataURL('image/webp', 0.85);
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    throw err;
  }
}

/**
 * Đọc ảnh hoặc URL ảnh trực tiếp từ bộ nhớ tạm (Clipboard):
 * Rất tiện khi người dùng vừa bấm Máy ảnh TradingView hoặc Alt + S -> Sao chép ảnh.
 */
export async function readImageFromClipboard(): Promise<string | null> {
  if (!navigator.clipboard) return null;
  try {
    // 1. Thử đọc dạng ảnh Blob
    if (navigator.clipboard.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const { dataUrl } = await compressImage(blob, 1600, 0.8);
            return dataUrl;
          }
        }
      }
    }
    // 2. Thử đọc dạng text nếu là link ảnh TradingView
    if (navigator.clipboard.readText) {
      const text = await navigator.clipboard.readText();
      const clean = text?.trim();
      if (clean && (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:image/'))) {
        return clean;
      }
    }
  } catch (err) {
    console.warn('Không thể đọc tự động từ Clipboard:', err);
  }
  return null;
}

