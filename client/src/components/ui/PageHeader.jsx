const PageHeader = ({
  title,
  subtitle,
  actions,
  backButton,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-6">
      <div className="min-w-0">
        {backButton && (
          <div className="mb-1">{backButton}</div>
        )}
        <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
        {subtitle && (
          <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}

export default PageHeader
