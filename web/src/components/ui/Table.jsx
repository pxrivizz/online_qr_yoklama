export const Table = ({ columns, data = [], loading = false, emptyMessage = 'Veri bulunamadı', className = '' }) => {
  // Skeleton row component
  const SkeletonRow = () => (
    <tr>
      {columns.map((col) => (
        <td key={col.key} className="px-5 py-4">
          <div className="h-4 bg-slate-100 rounded-lg animate-pulse" />
        </td>
      ))}
    </tr>
  );

  return (
    <>
      {/* Desktop Table */}
      <div className={`overflow-x-auto hidden md:block ${className}`}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              {columns.map((col) => (
                <th key={col.key} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => <SkeletonRow key={idx} />)
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                      <span className="text-xl">📋</span>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors duration-150">
                  {columns.map((col) => (
                    <td key={col.key} className="px-5 py-4 text-sm text-slate-700">
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className={`md:hidden space-y-3 ${className}`}>
        {loading ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-slate-100 p-4 space-y-3 animate-pulse">
              <div className="h-4 bg-slate-100 rounded-lg w-3/4" />
              <div className="h-3 bg-slate-100 rounded-lg w-1/2" />
              <div className="h-3 bg-slate-100 rounded-lg w-2/3" />
            </div>
          ))
        ) : data.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3 mx-auto">
              <span className="text-xl">📋</span>
            </div>
            <p className="text-sm text-slate-500 font-medium">{emptyMessage}</p>
          </div>
        ) : (
          data.map((row, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-slate-100 p-4 shadow-[0_1px_2px_0_rgb(0_0_0/0.03)] space-y-2.5">
              {columns.map((col) => {
                if (col.key === 'actions') {
                  return (
                    <div key={col.key} className="pt-2 mt-2 border-t border-slate-100 flex items-center gap-2">
                      {col.render ? col.render(row) : row[col.key]}
                    </div>
                  );
                }
                return (
                  <div key={col.key} className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider shrink-0">{col.label}</span>
                    <span className="text-sm text-slate-700 text-right truncate">
                      {col.render ? col.render(row) : row[col.key]}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </>
  );
};
