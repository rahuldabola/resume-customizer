"use client";

import dynamic from "next/dynamic";

// Client-only: the workspace restores saved versions from localStorage on first render.
export const ClientWorkspace = dynamic(() => import("./Workspace").then((m) => m.Workspace), {
  ssr: false,
  loading: () => <div className="mx-auto min-h-[60vh] w-full max-w-7xl" />,
});
