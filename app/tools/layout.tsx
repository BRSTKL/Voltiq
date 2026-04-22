import type { ReactNode } from "react";

import AppNav from "@/components/layout/AppNav";

export default function ToolsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppNav />
      <main>{children}</main>
    </>
  );
}
