import type { ReactNode } from "react";

// Every page under /team is now just a redirect to the supplier area (see
// the pages themselves), so there is nothing to frame here.
export default function TeamLayout({ children }: { children: ReactNode }) {
  return children;
}
