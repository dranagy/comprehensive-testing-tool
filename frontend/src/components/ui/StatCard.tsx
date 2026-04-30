interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  trend?: { value: string; positive: boolean };
  className?: string;
}

export default function StatCard({ label, value, icon, trend, className = "" }: StatCardProps) {
  return (
    <div className={`bg-surface rounded-lg border border-border-light p-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-display font-bold text-foreground mt-1">{value}</p>
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
            </svg>
          </div>
        )}
      </div>
      {trend && (
        <p className={`text-xs mt-2 ${trend.positive ? "text-success" : "text-error"}`}>
          {trend.positive ? "+" : ""}{trend.value}
        </p>
      )}
    </div>
  );
}
