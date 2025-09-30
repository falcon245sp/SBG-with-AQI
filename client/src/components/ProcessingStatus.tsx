import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcessingStatusProps {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  className?: string;
}

export function ProcessingStatus({ status, className }: ProcessingStatusProps) {
  const getConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: Clock,
          label: 'Pending',
          className: 'bg-slate-100 text-slate-800 border-slate-200'
        };
      case 'processing':
        return {
          icon: Loader2,
          label: 'Processing',
          className: 'bg-blue-100 text-blue-800 border-blue-200'
        };
      case 'completed':
        return {
          icon: CheckCircle,
          label: 'Complete',
          className: 'bg-green-100 text-green-800 border-green-200'
        };
      case 'failed':
        return {
          icon: AlertCircle,
          label: 'Failed',
          className: 'bg-red-100 text-red-800 border-red-200'
        };
      default:
        return {
          icon: Clock,
          label: 'Unknown',
          className: 'bg-slate-100 text-slate-800 border-slate-200'
        };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "inline-flex items-center gap-1 font-medium border",
        config.className,
        className
      )}
    >
      <Icon className={cn(
        "w-3 h-3",
        status === 'processing' && "animate-spin"
      )} />
      <span>{config.label}</span>
    </Badge>
  );
}
