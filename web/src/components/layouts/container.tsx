import type { ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}

export function Container({
  children,
  className = "",
  wide = false,
}: ContainerProps) {
  return (
    <div
      className={`${wide ? "max-w-7xl" : "max-w-4xl"} mx-auto px-4 sm:px-6 lg:px-8 ${className}`}
    >
      {children}
    </div>
  );
}
