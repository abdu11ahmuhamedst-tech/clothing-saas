import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Clothing SaaS — Your brand. Your storefront.",
  description: "A dedicated storefront for your clothing business. Explore our planned platform and simple pricing.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a>{children}</body></html>;
}
