import { Card, CardContent } from "@/components/ui/card";
import { Italic } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: Italic;
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
    <Card className="bg-white hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-neutral-600 text-sm font-medium">{title}</h4>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <p className="text-3xl font-medium text-neutral-900">{value}</p>
        {changeText && (
          <p className="text-sm text-neutral-600 mt-2">
            <span className={changeColor}>{changeText}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default StatsCard;
