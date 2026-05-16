import { Loader } from 'lucide-react';

export const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  className = '',
  ...props
}) => {
  const baseStyles = 'font-semibold rounded-xl transition-all duration-200 inline-flex items-center gap-2 justify-center cursor-pointer active:scale-[0.97]';
  const variants = {
    primary: 'bg-[#1E3A5F] text-white hover:bg-[#163050] hover:shadow-lg disabled:bg-slate-300 disabled:text-slate-500',
    secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm disabled:bg-slate-50 disabled:text-slate-400',
    danger: 'bg-rose-500 text-white hover:bg-rose-600 hover:shadow-lg disabled:bg-slate-300 disabled:text-slate-500',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-400',
    success: 'bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-lg disabled:bg-slate-300 disabled:text-slate-500',
  };
  const sizes = {
    sm: 'px-3.5 py-2 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${disabled || loading ? 'cursor-not-allowed opacity-60 !active:scale-100' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};
