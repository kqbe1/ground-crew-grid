import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface BackButtonProps {
  /** Override default navigate(-1) behavior */
  to?: string;
  /** Button label, defaults to "Retour". Set to "" for icon-only. */
  label?: string;
  /** Button variant */
  variant?: "outline" | "ghost";
  /** Button size */
  size?: "sm" | "default" | "icon";
}

export default function BackButton({ to, label = "Retour", variant = "outline", size = "sm" }: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) navigate(to);
    else navigate(-1);
  };

  if (size === "icon") {
    return (
      <Button variant={variant} size="icon" onClick={handleClick} title={label || "Retour"}>
        <ArrowLeft className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Button variant={variant} size={size} onClick={handleClick}>
      <ArrowLeft className="w-4 h-4 mr-1" />
      {label}
    </Button>
  );
}
