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
 * Upload ảnh lên Supabase Storage (nếu Storage Bucket được cấu hình):
 * - Lưu file vào bucket (mặc định 'trade-images' hoặc 'plans')
 * - Trả về publicUrl hoặc path reference
 * - Nếu Storage chưa được tạo trên Supabase project của user: trả về null và không làm crash app.
 */
export async function uploadImageToSupabaseStorage(
  blob: Blob,
  fileName: string,
  bucketName: string = 'trade-images'
): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client || !client.storage) {
    return null;
  }

  try {
    const cleanFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { data, error } = await client.storage
      .from(bucketName)
      .upload(cleanFileName, blob, {
        contentType: blob.type || 'image/webp',
        upsert: true,
      });

    if (error) {
      console.warn(`[Storage] Upload vào bucket '${bucketName}' không thành công:`, error.message);
      return null;
    }

    if (data?.path) {
      const { data: urlData } = client.storage.from(bucketName).getPublicUrl(data.path);
      return urlData?.publicUrl || data.path;
    }
    return null;
  } catch (err: any) {
    console.warn('[Storage] Ngoại lệ khi upload ảnh lên Supabase Storage:', err?.message || err);
    return null;
  }
}
