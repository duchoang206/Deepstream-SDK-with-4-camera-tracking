import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FMS - Vision Intelligence",
  description: "Fleet Management System Dashboard with Camera AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <nav className="navbar">
            <div className="nav-brand">
              FMS <span>v.1.3.1.3</span>
            </div>
            <div className="nav-links">
              <Link href="/monitor" className="nav-link">Monitor</Link>
              <Link href="/building" className="nav-link">Building</Link>
              <Link href="#" className="nav-link">Operation</Link>
              <Link href="#" className="nav-link">Analytics</Link>
            </div>
          </nav>
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
