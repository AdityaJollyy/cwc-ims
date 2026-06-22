import Button from './Button'

const Pagination = ({ meta, onPageChange, onLimitChange }) => {
  if (!meta || meta.total === 0) return null

  const { page, limit, totalPages, total, hasNextPage, hasPrevPage } = meta

  const pages = []
  const maxVisible = 5
  let start = Math.max(1, page - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages, start + maxVisible - 1)
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1)

  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
      <div className="flex items-center gap-2 text-sm text-slate-500 flex-wrap">
        <span>
          Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
        </span>
        <select
          value={limit}
          onChange={(e) => onLimitChange?.(Number(e.target.value))}
          className="h-8 pl-2 pr-6 rounded-lg border border-slate-200 text-sm bg-white outline-none cursor-pointer appearance-none"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasPrevPage}
          onClick={() => onPageChange(page - 1)}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          }
        />

        {start > 1 && (
          <>
            <PageButton num={1} current={page} onClick={onPageChange} />
            {start > 2 && <span className="px-1 text-slate-400 text-sm">…</span>}
          </>
        )}

        {pages.map((num) => (
          <PageButton key={num} num={num} current={page} onClick={onPageChange} />
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="px-1 text-slate-400 text-sm">…</span>}
            <PageButton num={totalPages} current={page} onClick={onPageChange} />
          </>
        )}

        <Button
          variant="ghost"
          size="sm"
          disabled={!hasNextPage}
          onClick={() => onPageChange(page + 1)}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          }
        />
      </div>
    </div>
  )
}

const PageButton = ({ num, current, onClick }) => (
  <button
    onClick={() => onClick(num)}
    className={[
      'w-8 h-8 rounded-lg text-sm font-medium transition-all',
      num === current
        ? 'bg-indigo-600 text-white shadow-sm'
        : 'text-slate-600 hover:bg-slate-100',
    ].join(' ')}
  >
    {num}
  </button>
)

export default Pagination
