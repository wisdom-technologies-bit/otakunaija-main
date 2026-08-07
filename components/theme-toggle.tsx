"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CircleIcon, EclipseIcon } from "@hugeicons/core-free-icons";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="text-foreground/80 hover:text-primary"
    >
      <div className="relative h-5 w-5">
        {mounted ? (
          <>
            <HugeiconsIcon icon={CircleIcon}
              size={20} strokeWidth={2} className={`absolute inset-0 h-5 w-5 transition-all duration-300 ${
                isDark
                  ? "rotate-90 scale-0 opacity-0"
                  : "rotate-0 scale-100 opacity-100"
              }`}
            />
            <HugeiconsIcon icon={EclipseIcon}
              size={20} strokeWidth={2} className={`absolute inset-0 h-5 w-5 transition-all duration-300 ${
                isDark
                  ? "rotate-0 scale-100 opacity-100"
                  : "-rotate-90 scale-0 opacity-0"
              }`}
            />
          </>
        ) : (
          <HugeiconsIcon icon={CircleIcon} size={20} strokeWidth={2} />
        )}
      </div>
    </Button>
  );
}
