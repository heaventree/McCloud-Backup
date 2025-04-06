import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  changeText?: string;
  changeColor?: string;
}

const StatsCard = ({
  title,
  value,
  icon: Icon,
  iconColor = "text-blue-600",
  iconBgColor = "bg-blue-100",
  changeText,
  changeColor = "text-green-600",
}: StatsCardProps) => {
  return (
    <div className="stats-card p-4">
      <div className="flex items-center">
        <div className={`stats-card-icon ${iconBgColor} h-9 w-9 mr-3 mb-0 flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        
        <div className="flex-1">
          <h3 className="stats-card-value text-xl mb-0">{value}</h3>
          <p className="stats-card-title">{title}</p>
        </div>
      </div>
      
      {changeText && (
        <div className="text-xs font-medium mt-2">
          <span className={`inline-flex items-center ${changeColor}`}>
            {changeText}
          </span>
        </div>
      )}
    </div>
  );
};

export default StatsCard;
