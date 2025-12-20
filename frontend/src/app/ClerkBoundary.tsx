'use client';

import { usePathname } from "next/navigation";
import { ClerkProvider } from "@clerk/nextjs";
import { jaJP } from "@clerk/localizations";
import type { ReactNode } from "react";

type ClerkBoundaryProps = {
  children: ReactNode;
};

const isEmbedRoute = (pathname: string) =>
  pathname === "/embed" || pathname.startsWith("/embed/");

export default function ClerkBoundary({ children }: ClerkBoundaryProps) {
  const pathname = usePathname() ?? "";

  if (isEmbedRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider localization={jaJP}>
      {children}
    </ClerkProvider>
  );
}
