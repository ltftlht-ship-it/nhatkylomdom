import React, { useState, useEffect } from 'react';
import { PreChecklistItem, PostMistakeItem, SetupTagItem } from '../types';
import { DEFAULT_PRE_CHECKLIST, DEFAULT_POST_MISTAKES, DEFAULT_SETUP_TAGS } from '../data/mockTrades';
import { 
  getSavedTimeframeOptions, 
  saveTimeframeOptions, 
  DEFAULT_TIMEFRAME_OPTIONS 
} from '../utils/tradeCalculations';
import { useLanguage } from '../context/LanguageContext';
import { 
  X, 
  Trash2
} from 'lucide-react';

interface ChecklistEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  preChecklistItems: PreChecklistItem[];
  postMistakeItems: PostMistakeItem[];
  setupTags: SetupTagItem[];
  onSave: (
    newPre: PreChecklistItem[],
    newPost: PostMistakeItem[],
    newSetups: SetupTagItem[]
  ) => void;
  onResetDefaults?: () => void;
}

export const ChecklistEditorModal: React.FC<ChecklistEditorModalProps> = ({
  isOpen,
  onClose,
  preChecklistItems,
  postMistakeItems,
  setupTags,
  onSave,
  onResetDefaults
}) => {
  const { language } = useLanguage();
  const isVi = language === 'vi';

  const [activeTab, setActiveTab] = useState<'pre' | 'post' | 'setup' | 'tf'>('pre');
  const [localPre, setLocalPre] = useState<PreChecklistItem[]>([]);
  const [localPost, setLocalPost] = useState<PostMistakeItem[]>([]);
  const [localSetups, setLocalSetups] = useState<SetupTagItem[]>([]);
  const [localTfs, setLocalTfs] = useState<string[]>([]);

  // Inputs for adding new items
  const [newPreLabel, setNewPreLabel] = useState('');
  const [newPrePoints, setNewPrePoints] = useState<number>(10);
  const [newPostLabel, setNewPostLabel] = useState('');
  const [newPostPenalty, setNewPostPenalty] = useState<number>(-20);
  const [newPostIsEarly, setNewPostIsEarly] = useState(false);
  const [newSetupLabel, setNewSetupLabel] = useState('');
  const [newTfLabel, setNewTfLabel] = useState('');

  // Sync state whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setLocalPre(preChecklistItems.map(item => ({ ...item })));
      setLocalPost(postMistakeItems.map(item => ({ ...item })));
      setLocalSetups(setupTags.map(item => ({ ...item })));
      setLocalTfs(getSavedTimeframeOptions());
    }
  }, [isOpen, preChecklistItems, postMistakeItems, setupTags]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Handlers for Pre-Checklist
  const handlePreChange = (id: string, field: 'label' | 'points', val: any) => {
    setLocalPre(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: field === 'points' ? Number(val) || 0 : val } : item))
    );
  };

  const handleAddPre = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPreLabel.trim()) return;
    const newItem: PreChecklistItem = {
      id: `pre_${Date.now()}`,
      label: newPreLabel.trim(),
      points: Number(newPrePoints) || 10
    };
    setLocalPre(prev => [...prev, newItem]);
    setNewPreLabel('');
    setNewPrePoints(10);
  };

  const handleDeletePre = (id: string) => {
    setLocalPre(prev => prev.filter(item => item.id !== id));
  };

  // Handlers for Post-Mistakes
  const handlePostChange = (id: string, field: 'label' | 'penalty_points' | 'is_early_exit', val: any) => {
    setLocalPost(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: field === 'penalty_points' ? Number(val) || 0 : val } : item))
    );
  };

  const handleAddPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostLabel.trim()) return;
    const newItem: PostMistakeItem = {
      id: `post_${Date.now()}`,
      label: newPostLabel.trim(),
      penalty_points: Number(newPostPenalty) || -20,
      is_early_exit: newPostIsEarly
    };
    setLocalPost(prev => [...prev, newItem]);
    setNewPostLabel('');
    setNewPostPenalty(-20);
    setNewPostIsEarly(false);
  };

  const handleDeletePost = (id: string) => {
    setLocalPost(prev => prev.filter(item => item.id !== id));
  };

  // Handlers for Setup Tags
  const handleSetupChange = (id: string, label: string) => {
    setLocalSetups(prev =>
      prev.map(item => (item.id === id ? { ...item, label } : item))
    );
  };

  const handleAddSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSetupLabel.trim()) return;
    const newItem: SetupTagItem = {
      id: `setup_${Date.now()}`,
      label: newSetupLabel.trim()
    };
    setLocalSetups(prev => [...prev, newItem]);
    setNewSetupLabel('');
  };

  const handleDeleteSetup = (id: string) => {
    setLocalSetups(prev => prev.filter(item => item.id !== id));
  };

  // Handlers for Timeframe Options
  const handleTfChange = (index: number, val: string) => {
    const clean = val.trim().toUpperCase();
    setLocalTfs(prev => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });
  };

  const handleAddTf = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTfLabel.trim().toUpperCase();
    if (!clean || localTfs.includes(clean)) return;
    setLocalTfs(prev => [...prev, clean]);
    setNewTfLabel('');
  };

  const handleDeleteTf = (tf: string) => {
    setLocalTfs(prev => prev.filter(item => item !== tf));
  };

  // Reset to Defaults
  const handleReset = () => {
    const confirmMsg = isVi 
      ? 'Thầy có chắc muốn khôi phục toàn bộ tiêu chí, setup và khung thời gian về mặc định không?'
      : 'Are you sure you want to reset all criteria, setups, and timeframes to default?';
    if (window.confirm(confirmMsg)) {
      setLocalPre(DEFAULT_PRE_CHECKLIST.map(item => ({ ...item })));
      setLocalPost(DEFAULT_POST_MISTAKES.map(item => ({ ...item })));
      setLocalSetups(DEFAULT_SETUP_TAGS.map(item => ({ ...item })));
      setLocalTfs([...DEFAULT_TIMEFRAME_OPTIONS]);
      if (onResetDefaults) onResetDefaults();
    }
  };

  // Save All Changes
  const handleSave = () => {
    saveTimeframeOptions(localTfs);
    window.dispatchEvent(new Event('timeframe_options_updated'));
    onSave(localPre, localPost, localSetups);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
      <div className="clay-card border border-[var(--border-main)] w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-[var(--text-primary)]">
        {/* Header Modal - Không icon rườm rà, không chú thích dài */}
        <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between bg-[var(--bg-card)] shrink-0">
          <h2 className="text-sm sm:text-base font-bold text-[#1d1b17]">
            {isVi ? 'Tùy Chỉnh Checklist, Setup & Khung Thời Gian' : 'Checklist, Setups & Timeframe Editor'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[#1d1b17] rounded-lg hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sub-Tabs - Không icon phía trước */}
        <div className="flex border-b border-[var(--border-main)] px-5 bg-[var(--bg-card)] text-xs font-semibold shrink-0 overflow-x-auto gap-1">
          <button
            onClick={() => setActiveTab('pre')}
            className={`py-3 px-3.5 flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'pre'
                ? 'border-[#1d1b17] text-[#1d1b17] font-bold bg-[var(--bg-subtle)]/50 rounded-t-lg'
                : 'border-transparent text-[var(--text-muted)] hover:text-[#1d1b17]'
            }`}
          >
            <span>{isVi ? '1. Tiêu Chí Kỷ Luật' : '1. Discipline Checklist'} ({localPre.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('post')}
            className={`py-3 px-3.5 flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'post'
                ? 'border-[#1d1b17] text-[#1d1b17] font-bold bg-[var(--bg-subtle)]/50 rounded-t-lg'
                : 'border-transparent text-[var(--text-muted)] hover:text-[#1d1b17]'
            }`}
          >
            <span>{isVi ? '2. Lỗi Tâm Lý & Kỷ Luật' : '2. Psychology & Mistakes'} ({localPost.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('setup')}
            className={`py-3 px-3.5 flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'setup'
                ? 'border-[#1d1b17] text-[#1d1b17] font-bold bg-[var(--bg-subtle)]/50 rounded-t-lg'
                : 'border-transparent text-[var(--text-muted)] hover:text-[#1d1b17]'
            }`}
          >
            <span>{isVi ? '3. Setup Kỹ Thuật' : '3. Technical Setups'} ({localSetups.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tf')}
            className={`py-3 px-3.5 flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'tf'
                ? 'border-[#1d1b17] text-[#1d1b17] font-bold bg-[var(--bg-subtle)]/50 rounded-t-lg'
                : 'border-transparent text-[var(--text-muted)] hover:text-[#1d1b17]'
            }`}
          >
            <span>{isVi ? '4. Khung Thời Gian' : '4. Timeframes'} ({localTfs.length})</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs bg-white">
          {/* TAB 1: PRE-CHECKLIST */}
          {activeTab === 'pre' && (
            <div className="space-y-4">
              {/* Add new pre-checklist item form */}
              <form onSubmit={handleAddPre} className="flex gap-2 items-center p-3 rounded-xl border border-[var(--border-main)] bg-white">
                <input
                  type="text"
                  placeholder={isVi ? 'Nhập tiêu chí kỷ luật mới...' : 'Enter new discipline rule label...'}
                  value={newPreLabel}
                  onChange={(e) => setNewPreLabel(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--border-main)] text-xs text-[#1d1b17] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#1d1b17]"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-[var(--text-muted)]">{isVi ? 'Điểm (+):' : 'Pts (+):'}</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newPrePoints}
                    onChange={(e) => setNewPrePoints(Number(e.target.value))}
                    className="w-16 px-2 py-1.5 rounded-lg border border-[var(--border-main)] text-xs font-mono font-bold text-[#1d1b17] text-center focus:outline-none focus:border-[#1d1b17]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newPreLabel.trim()}
                  className="px-4 py-1.5 rounded-lg border border-[var(--border-main)] text-[#1d1b17] bg-[var(--bg-subtle)] hover:bg-[var(--border-main)]/30 font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shrink-0"
                >
                  {isVi ? 'Thêm' : 'Add'}
                </button>
              </form>

              {/* Pre-checklist items list (Clean white container with line dividers) */}
              <div className="rounded-xl border border-[var(--border-main)] bg-white overflow-hidden divide-y divide-[var(--border-subtle)]/80">
                {localPre.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2.5 hover:bg-[var(--bg-subtle)]/40 transition-colors">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => handlePreChange(item.id, 'label', e.target.value)}
                      className="flex-1 px-2.5 py-1 rounded-lg border border-[var(--border-main)] text-xs text-[#1d1b17] bg-white focus:outline-none focus:border-[#1d1b17]"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] text-[var(--text-muted)]">{isVi ? 'Điểm:' : 'Pts:'}</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={item.points}
                        onChange={(e) => handlePreChange(item.id, 'points', e.target.value)}
                        className="w-14 px-2 py-1 rounded-lg border border-[var(--border-main)] text-xs font-mono font-bold text-[#1d1b17] text-center bg-white focus:outline-none focus:border-[#1d1b17]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePre(item.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-[var(--text-muted)] hover:text-rose-500 transition-colors cursor-pointer shrink-0"
                      title={isVi ? 'Xóa' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: POST-MISTAKES */}
          {activeTab === 'post' && (
            <div className="space-y-4">
              {/* Add new mistake item form */}
              <form onSubmit={handleAddPost} className="flex gap-2 items-center p-3 rounded-xl border border-[var(--border-main)] bg-white">
                <input
                  type="text"
                  placeholder={isVi ? 'Nhập lỗi tâm lý / vào sai lệnh...' : 'Enter new mistake description...'}
                  value={newPostLabel}
                  onChange={(e) => setNewPostLabel(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--border-main)] text-xs text-[#1d1b17] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#1d1b17]"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-[var(--text-muted)]">{isVi ? 'Phạt (-):' : 'Pts (-):'}</span>
                  <input
                    type="number"
                    max="-1"
                    value={newPostPenalty}
                    onChange={(e) => setNewPostPenalty(Number(e.target.value))}
                    className="w-16 px-2 py-1.5 rounded-lg border border-[var(--border-main)] text-xs font-mono font-bold text-[#1d1b17] text-center focus:outline-none focus:border-[#1d1b17]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newPostLabel.trim()}
                  className="px-4 py-1.5 rounded-lg border border-[var(--border-main)] text-[#1d1b17] bg-[var(--bg-subtle)] hover:bg-[var(--border-main)]/30 font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shrink-0"
                >
                  {isVi ? 'Thêm' : 'Add'}
                </button>
              </form>

              {/* Mistakes items list (Clean white container with line dividers) */}
              <div className="rounded-xl border border-[var(--border-main)] bg-white overflow-hidden divide-y divide-[var(--border-subtle)]/80">
                {localPost.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2.5 hover:bg-[var(--bg-subtle)]/40 transition-colors">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => handlePostChange(item.id, 'label', e.target.value)}
                      className="flex-1 px-2.5 py-1 rounded-lg border border-[var(--border-main)] text-xs text-[#1d1b17] bg-white focus:outline-none focus:border-[#1d1b17]"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] text-[var(--text-muted)]">{isVi ? 'Phạt:' : 'Pts:'}</span>
                      <input
                        type="number"
                        value={item.penalty_points}
                        onChange={(e) => handlePostChange(item.id, 'penalty_points', e.target.value)}
                        className="w-14 px-2 py-1 rounded-lg border border-[var(--border-main)] text-xs font-mono font-bold text-[#1d1b17] text-center bg-white focus:outline-none focus:border-[#1d1b17]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePost(item.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-[var(--text-muted)] hover:text-rose-500 transition-colors cursor-pointer shrink-0"
                      title={isVi ? 'Xóa' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: TECHNICAL SETUPS */}
          {activeTab === 'setup' && (
            <div className="space-y-4">
              {/* Add new setup item form */}
              <form onSubmit={handleAddSetup} className="flex gap-2 items-center p-3 rounded-xl border border-[var(--border-main)] bg-white">
                <input
                  type="text"
                  placeholder={isVi ? 'Nhập tên setup kỹ thuật mới...' : 'Enter new technical setup name...'}
                  value={newSetupLabel}
                  onChange={(e) => setNewSetupLabel(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--border-main)] text-xs text-[#1d1b17] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#1d1b17]"
                />
                <button
                  type="submit"
                  disabled={!newSetupLabel.trim()}
                  className="px-4 py-1.5 rounded-lg border border-[var(--border-main)] text-[#1d1b17] bg-[var(--bg-subtle)] hover:bg-[var(--border-main)]/30 font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shrink-0"
                >
                  {isVi ? 'Thêm' : 'Add'}
                </button>
              </form>

              {/* Setup items list (Clean white container with line dividers) */}
              <div className="rounded-xl border border-[var(--border-main)] bg-white overflow-hidden divide-y divide-[var(--border-subtle)]/80">
                {localSetups.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2.5 hover:bg-[var(--bg-subtle)]/40 transition-colors">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => handleSetupChange(item.id, e.target.value)}
                      className="flex-1 px-2.5 py-1 rounded-lg border border-[var(--border-main)] text-xs text-[#1d1b17] bg-white focus:outline-none focus:border-[#1d1b17]"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteSetup(item.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-[var(--text-muted)] hover:text-rose-500 transition-colors cursor-pointer shrink-0"
                      title={isVi ? 'Xóa' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: TIMEFRAMES (TF) */}
          {activeTab === 'tf' && (
            <div className="space-y-4">
              {/* Add new timeframe form */}
              <form onSubmit={handleAddTf} className="flex gap-2 items-center p-3 rounded-xl border border-[var(--border-main)] bg-white">
                <input
                  type="text"
                  placeholder={isVi ? 'Ví dụ: M2, M3, H2, W1...' : 'e.g. M2, M3, H2, W1...'}
                  value={newTfLabel}
                  onChange={(e) => setNewTfLabel(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--border-main)] text-xs font-mono font-bold text-[#1d1b17] uppercase placeholder-[var(--text-muted)] focus:outline-none focus:border-[#1d1b17]"
                />
                <button
                  type="submit"
                  disabled={!newTfLabel.trim()}
                  className="px-4 py-1.5 rounded-lg border border-[var(--border-main)] text-[#1d1b17] bg-[var(--bg-subtle)] hover:bg-[var(--border-main)]/30 font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shrink-0"
                >
                  {isVi ? 'Thêm' : 'Add'}
                </button>
              </form>

              {/* Timeframe items list (Clean white container with line dividers) */}
              <div className="rounded-xl border border-[var(--border-main)] bg-white overflow-hidden divide-y divide-[var(--border-subtle)]/80">
                {localTfs.map((tf, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 p-2.5 hover:bg-[var(--bg-subtle)]/40 transition-colors">
                    <input
                      type="text"
                      value={tf}
                      onChange={(e) => handleTfChange(idx, e.target.value)}
                      className="w-24 px-2.5 py-1 rounded-lg border border-[var(--border-main)] text-xs font-mono font-bold text-[#1d1b17] uppercase bg-white focus:outline-none focus:border-[#1d1b17]"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteTf(tf)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-[var(--text-muted)] hover:text-rose-500 transition-colors cursor-pointer"
                      title={isVi ? 'Xóa' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions - Save Change màu giống Cancel, không logo */}
        <div className="px-5 py-3.5 border-t border-[var(--border-main)] flex items-center justify-between bg-white shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 rounded-xl border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[#1d1b17] font-medium text-xs transition-colors cursor-pointer bg-white hover:bg-[var(--bg-subtle)]"
          >
            <span>{isVi ? 'Khôi Phục Mặc Định' : 'Reset Defaults'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-[var(--border-main)] text-[var(--text-secondary)] hover:text-[#1d1b17] font-medium text-xs transition-colors cursor-pointer bg-white hover:bg-[var(--bg-subtle)]"
            >
              {isVi ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl border border-[var(--border-main)] text-[#1d1b17] font-bold text-xs shadow-xs transition-all cursor-pointer bg-white hover:bg-[var(--bg-subtle)]"
            >
              {isVi ? 'Lưu Thay Đổi' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
