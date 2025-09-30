import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface RigorBadgeProps {
  level: 'mild' | 'medium' | 'spicy';
  className?: string;
}

export function RigorBadge({ level, className }: RigorBadgeProps) {
  const getConfig = () => {
    switch (level) {
      case 'mild':
        return {
          icon: '🍃',
          label: 'Mild',
          description: 'DOK 1-2',
          className: 'bg-green-100 text-green-800 border-green-200'
        };
      case 'medium':
        return {
          icon: '🌶️',
          label: 'Medium',
          description: 'DOK 2-3',
          className: 'bg-amber-100 text-amber-800 border-amber-200'
        };
      case 'spicy':
        return {
          icon: '🔥',
          label: 'Spicy',
          description: 'DOK 3-4',
          className: 'bg-red-100 text-red-800 border-red-200'
        };
      default:
        return {
          icon: '❓',
          label: 'Unknown',
          description: '',
          className: 'bg-slate-100 text-slate-800 border-slate-200'
        };
    }
  };

  const config = getConfig();

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "inline-flex items-center gap-1 font-medium border",
        config.className,
        className
      )}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </Badge>
  );
}
