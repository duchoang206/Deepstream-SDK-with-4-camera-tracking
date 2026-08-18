import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import React from 'react';
import Navigation from '../components/Navigation';
import { LanguageProvider } from '../components/LanguageContext';
import { TabProvider } from '../components/TabContext';
import { CameraProvider } from '../components/CameraContext';
import HeaderActions from '../components/HeaderActions';

export const metadata: Metadata = {
  title: 'VMS-RTC',
  description: 'Vision AI YOLO Backend System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <CameraProvider>
            <TabProvider>
              <div className="fms-layout">
              {/* TOP HEADER */}
              <header className="fms-header">
                {/* Left: Brand */}
                <div className="fms-brand">
                  <img src="/logo.png" alt="Header Logo" style={{ height: '56px', objectFit: 'contain' }} />
                  <span className="brand-text" style={{ marginLeft: '8px' }}>VMS</span>
                  <span className="brand-version">v 1.0</span>
                </div>

                {/* Center: Navigation */}
                <Navigation />

                {/* Right: Actions */}
                <HeaderActions />
              </header>

              {/* MAIN CONTENT AREA */}
              <main className="fms-main">
                {children}
              </main>
              </div>
            </TabProvider>
          </CameraProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
