import React from 'react';
import { X, ZoomIn, Download } from 'lucide-react';

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
  if (!isOpen || !imageUrl) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0f141d]/80 rounded-t-xl border border-slate-800 text-xs">
        <span className="font-bold text-slate-200 text-sm">{title}</span>
        <div className="flex items-center gap-2">
          <a
            href={imageUrl}
            download="trade-chart.png"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Tải ảnh về"
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image display */}
      <div className="flex-1 flex items-center justify-center p-4 bg-[#080b10] rounded-b-xl border-x border-b border-slate-800 overflow-auto">
        <img
          src={imageUrl}
          alt={title}
          className="max-h-[85vh] max-w-full object-contain rounded shadow-2xl border border-slate-800/80"
        />
      </div>
    </div>
  );
};
