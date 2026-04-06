export default function MetricCard({ label, value, sub, trend, icon: Icon, accent }) {
  const trendColor = trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-gray-500';

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-gray-500 text-sm">{label}</span>
        {Icon && (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent || 'bg-dark-600'}`}>
            <Icon size={16} className="text-gray-300" />
          </div>
        )}
      </div>
      <p className="text-white text-2xl font-bold mb-1">{value ?? '—'}</p>
      {(sub || trend !== undefined) && (
        <p className={`text-sm ${trend !== undefined ? trendColor : 'text-gray-500'}`}>
          {trend !== undefined && trend > 0 ? '+' : ''}{trend !== undefined ? trend : ''} {sub}
        </p>
      )}
    </div>
  );
}
