import React, { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './context/LanguageContext';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Error Caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0d1117] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-8 max-w-lg w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h2 className="text-lg font-bold text-slate-100">Đã xảy ra lỗi hiển thị</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-mono bg-[#0d1117] p-3 rounded-lg border border-[#30363d] text-left break-all">
              {this.state.error?.message || 'Có lỗi ngoài ý muốn trong quá trình kết xuất giao diện.'}
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Tải lại ứng dụng (Reload)
              </button>
              <button
                type="button"
                onClick={() => {
                  (this as any).setState({ hasError: false, error: null });
                }}
                className="px-4 py-2 rounded-xl bg-[#252b35] hover:bg-[#30363d] text-slate-200 text-xs font-semibold transition-all border border-[#30363d] cursor-pointer"
              >
                Thử lại (Retry)
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
);

