import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'error' | 'success' | 'info';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    error: 'bg-red-900/90 border-red-500 text-white',
    success: 'bg-accent/90 border-accent text-black',
    info: 'bg-[#222]/90 border-gray-500 text-white'
  };

  const icons = {
    error: 'fa-exclamation-circle',
    success: 'fa-check-circle',
    info: 'fa-info-circle'
  };

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-full border shadow-2xl backdrop-blur-md flex items-center gap-3 animate-fade-in ${colors[type]}`}>
      <i className={`fas ${icons[type]}`}></i>
      <span className="font-bold text-sm">{message}</span>
    </div>
  );
};

export default Toast;