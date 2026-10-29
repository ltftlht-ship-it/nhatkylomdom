import React, { useEffect, useState } from 'react';
import { isJournalRef, resolveImageRef, normalizeImageSource } from '../utils/imageUtils';

/** Thẻ ảnh hiển thị được cả ảnh trong kho riêng tư (sb://journal/...), link thường và base64 */
export const JournalImg: React.FC<React.ImgHTMLAttributes<HTMLImageElement> & { src?: string }> = ({ src, ...rest }) => {
  const [url, setUrl] = useState(() => (src && !isJournalRef(src) ? normalizeImageSource(src) : ''));
  useEffect(() => {
    let alive = true;
    resolveImageRef(src).then(u => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [src]);
  if (!url) return null;
  return <img src={url} {...rest} />;
};
