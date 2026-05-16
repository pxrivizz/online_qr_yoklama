export const Card = ({ title, subtitle, children, className = '', action }) => {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 p-6 shadow-[0_1px_3px_0_rgb(0_0_0/0.04),0_2px_8px_0_rgb(0_0_0/0.04)] transition-all duration-200 hover:shadow-[0_4px_6px_-1px_rgb(0_0_0/0.05),0_2px_4px_-2px_rgb(0_0_0/0.05)] ${className}`}>
      {(title || subtitle || action) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {title && <h3 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
