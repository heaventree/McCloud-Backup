import React, { useState } from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { Rocket } from "lucide-react";
import BackupWizard from "./BackupWizard";
import { Site } from "@/lib/types";
import { cn } from "@/lib/utils";

interface OneClickBackupButtonProps extends ButtonProps {
  site: Site;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  children?: React.ReactNode;
}

const OneClickBackupButton: React.FC<OneClickBackupButtonProps> = ({ 
  site, 
  variant = "default", 
  className, 
  children,
  ...props 
}) => {
  const [wizardOpen, setWizardOpen] = useState(false);
  
  const handleClick = () => {
    setWizardOpen(true);
  };
  
  return (
    <>
      <Button
        variant={variant}
        onClick={handleClick}
        className={cn("group", className)}
        {...props}
      >
        <Rocket className="mr-2 h-4 w-4 transition-transform group-hover:-translate-y-1 group-hover:rotate-12" />
        {children || "One-Click Backup"}
      </Button>
      
      <BackupWizard 
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        site={site}
      />
    </>
  );
};

export default OneClickBackupButton;