import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  changeText?: string;
  changeColor?: string;
}

const StatsCard = ({
  title,
  value,
  icon: Icon,
  iconColor = "text-primary",
  changeText,
  changeColor = "text-green-600",
}: StatsCardProps) => {
  return (
    <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-gray-700 text-sm font-medium">{title}</h4>
          <div className="flex items-center justify-center w-8 h-8">
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
        <p className="text-2xl font-semibold text-gray-900 mb-1">{value}</p>
        {changeText && (
          <p className="text-xs mt-1">
            <span className={changeColor}>{changeText}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default StatsCard;
