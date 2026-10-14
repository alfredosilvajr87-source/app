// Cabeçalho padrão das páginas: ícone, título, subtítulo e ações à direita
const PageHeader = ({ icon: Icon, title, subtitle, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div className="flex items-center gap-4 min-w-0">
      {Icon && (
        <div className="page-title-icon">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-slate-500 mt-0.5 text-sm">{subtitle}</p>}
      </div>
    </div>
    {children && <div className="flex flex-wrap sm:flex-nowrap gap-3 shrink-0">{children}</div>}
  </div>
);

export default PageHeader;
