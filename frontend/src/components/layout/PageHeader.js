// Cabeçalho padrão das páginas: ícone, título, subtítulo e ações à direita
const PageHeader = ({ icon: Icon, title, subtitle, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div className="flex items-center gap-4 min-w-0">
      {Icon && (
        <div className="page-title-icon">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <div className="min-w-0">
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="text-slate-400 mt-1 text-base">{subtitle}</p>}
      </div>
    </div>
    {children && <div className="flex flex-wrap sm:flex-nowrap gap-3 shrink-0">{children}</div>}
  </div>
);

export default PageHeader;
