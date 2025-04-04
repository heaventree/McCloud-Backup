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
    <div className="stats-card">
      <div className={`stats-card-icon ${iconBgColor}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      
      <div className="flex-1">
        <h3 className="stats-card-value">{value}</h3>
        <p className="stats-card-title">{title}</p>
      </div>
      
      {changeText && (
        <div className="mt-3 text-xs font-medium">
          <span className={`inline-flex items-center ${changeColor}`}>
            {changeText}
          </span>
        </div>
      )}
    </div>
  );
};

export default StatsCard;
