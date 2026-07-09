import { cn } from "../../lib/utils";

const variantStyles = {
  default:
    "border-transparent bg-primary text-primary-foreground shadow",
  secondary:
    "border-transparent bg-secondary text-secondary-foreground",
  outline: "text-foreground",
};

export default function Badge({ className, variant = "default", children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-400 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variantStyles[variant] || variantStyles.default,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}