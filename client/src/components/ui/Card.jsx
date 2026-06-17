const Card = ({ children, className = '', padding = 'md', shadow = true, onClick }) => {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  }

  return (
    <div
      onClick={onClick}
      className={[
        'bg-white rounded-xl border border-slate-200',
        shadow ? 'shadow-sm' : '',
        paddings[padding],
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export default Card
