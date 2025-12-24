import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Flag } from 'lucide-react';

const BrandBadge = ({ bandeira, size = 'sm', showIcon = false }) => {
  const brandConfig = {
    bandeira_branca: {
      label: 'CACIQUE',
      color: 'bg-red-600 hover:bg-red-700 text-white',
      icon: '⚪'
    },
    ipiranga: {
      label: 'Ipiranga',
      color: 'bg-blue-600 hover:bg-blue-700 text-white',
      icon: '🔵'
    },
    shell: {
      label: 'Shell',
      color: 'bg-yellow-500 hover:bg-yellow-600 text-white',
      icon: '🟡'
    },
    vibra: {
      label: 'Vibra',
      color: 'bg-purple-600 hover:bg-purple-700 text-white',
      icon: '🟣'
    },
    federal: {
      label: 'Federal',
      color: 'bg-orange-600 hover:bg-orange-700 text-white',
      icon: '🟠'
    }
  };

  const brand = brandConfig[bandeira];
  if (!brand) return null;

  const sizeClasses = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  return (
    <Badge 
      className={`${brand.color} ${sizeClasses[size]} font-semibold border-0`}
      variant="default"
    >
      {showIcon && <span className="mr-1">{brand.icon}</span>}
      {brand.label}
    </Badge>
  );
};

export default BrandBadge;
