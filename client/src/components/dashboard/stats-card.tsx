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
    <div className="stats-card p-3">
      <div className="flex items-start">
        <div className={`stats-card-icon ${iconBgColor} h-7 w-7 mr-3 rounded-sm flex items-center justify-center`}>
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        </div>
        
        <div className="flex-1 flex flex-col">
          <h3 className="stats-card-value text-xl leading-tight">{value}</h3>
          <p className="stats-card-title mb-1.5">{title}</p>
          
          {changeText && (
            <div className="text-xs font-medium mt-auto">
              <span className={`inline-flex items-center ${changeColor}`}>
                {changeText}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
