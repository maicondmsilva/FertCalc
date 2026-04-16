import React from 'react';

export type KPIColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: KPIColor;
  loading?: boolean;
  onClick?: () => void;
}

const colorMap: Record<KPIColor, { bg: string; iconBg: string; iconText: string; text: string }> = {
  blue:   { bg: 'bg-blue-50 border-blue-100',   iconBg: 'bg-blue-100',   iconText: 'text-blue-600',   text: 'text-blue-700' },
  green:  { bg: 'bg-green-50 border-green-100', iconBg: 'bg-green-100',  iconText: 'text-green-600',  text: 'text-green-700' },
  yellow: { bg: 'bg-yellow-50 border-yellow-100', iconBg: 'bg-yellow-100', iconText: 'text-yellow-600', text: 'text-yellow-700' },
  red:    { bg: 'bg-red-50 border-red-100',     iconBg: 'bg-red-100',    iconText: 'text-red-600',    text: 'text-red-700' },
  purple: { bg: 'bg-purple-50 border-purple-100', iconBg: 'bg-purple-100', iconText: 'text-purple-600', text: 'text-purple-700' },
  orange: { bg: 'bg-orange-50 border-orange-100', iconBg: 'bg-orange-100', iconText: 'text-orange-600', text: 'text-orange-700' },
};

export default function KPICard({
  title,
  value,
  subtitle,
  icon,
  color = 'blue',
  loading = false,
  onClick,
}: KPICardProps) {
  const c = colorMap[color];

  if (loading) {
    return (
      <div className={`rounded-2xl border p-5 ${c.bg} animate-pulse`}>
        <div className="flex items-start justify-between">
          <div className={`${c.iconBg} rounded-xl p-3 w-12 h-12`} />
          <div className="h-4 bg-stone-200 rounded w-16" />
        </div>
        <div className="mt-4 h-7 bg-stone-200 rounded w-24" />
        <div className="mt-2 h-3 bg-stone-200 rounded w-32" />
      </div>
    );
  }

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      onClick={onClick}
      className={`rounded-2xl border p-5 ${c.bg} transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] text-left w-full' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className={`${c.iconBg} rounded-xl p-3 ${c.iconText}`}>{icon}</div>
      </div>
      <p className="mt-4 text-2xl font-black text-stone-800">{value}</p>
      <p className={`text-sm font-semibold ${c.text} mt-0.5`}>{title}</p>
      {subtitle && <p className="text-xs text-stone-500 mt-1">{subtitle}</p>}
    </Tag>
  );
}
