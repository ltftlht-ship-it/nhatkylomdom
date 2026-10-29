import React from 'react';
import { X, ZoomIn, Download } from 'lucide-react';
import { resolveImageRef } from '../utils/imageUtils';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
}) => {
  // Listen for Escape key to quickly exit viewer
  // Ảnh trong kho riêng tư (sb://journal/...) đổi sang link xem tạm
  const [resolvedUrl, setResolvedUrl] = React.useState('');
  React.useEffect(() => {
    let alive = true;
    resolveImageRef(imageUrl).then(u => { if (alive) setResolvedUrl(u); });
    return () => { alive = false; };
  }, [imageUrl]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !resolvedUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 select-none cursor-pointer"
      onClick={onClose}
    >
      {/* Top bar */}
      <div 
        className="flex items-center justify-between px-4 py-2 bg-[#0f141d]/80 rounded-t-xl border border-slate-800 text-xs shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="font-bold text-slate-200 text-sm truncate pr-2">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={resolvedUrl}
            download="trade-chart.png"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Tải ảnh về"
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Đóng (Esc / Click ảnh)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image display: Click vào ảnh hoặc vùng chứa ảnh để đóng lại ngay */}
      <div 
        className="flex-1 flex items-center justify-center p-4 bg-[#080b10] rounded-b-xl border-x border-b border-slate-800 overflow-auto cursor-pointer"
        onClick={onClose}
      >
        <img
          src={resolvedUrl}
          alt={title}
          onClick={onClose}
          className="max-h-[85vh] max-w-full object-contain rounded shadow-2xl border border-slate-800/80 cursor-pointer transition-transform hover:opacity-95"
          title="Click để đóng hình"
        />
      </div>
    </div>
  );
};
