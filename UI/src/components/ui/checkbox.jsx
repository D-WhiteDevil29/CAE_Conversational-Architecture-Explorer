import * as React from "react";
import { Check } from "lucide-react";

const Checkbox = React.forwardRef(({ className = "", checked, onCheckedChange, id, ...props }, ref) => {
  const handleChange = (e) => {
    if (onCheckedChange) {
      onCheckedChange(e.target.checked);
    }
  };

  return (
    <div className="relative inline-block">
      <input
        type="checkbox"
        ref={ref}
        id={id}
        checked={checked}
        onChange={handleChange}
        className="peer sr-only"
        {...props}
      />
      <label
        htmlFor={id}
        className={`flex h-4 w-4 cursor-pointer items-center justify-center rounded-sm border border-primary ring-offset-background transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-checked:bg-primary peer-checked:text-primary-foreground ${className}`}
      >
        {checked && <Check className="h-3 w-3" />}
      </label>
    </div>
  );
});
Checkbox.displayName = "Checkbox";

export { Checkbox };
