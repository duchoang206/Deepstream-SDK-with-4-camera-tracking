'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from './LanguageContext';

export default function Navigation() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <nav className="fms-nav">
      <Link 
        href="/monitor" 
        className={`fms-nav-item ${pathname === '/monitor' ? 'active' : ''}`}
      >
        {t.nav.monitor}
      </Link>
      <Link 
        href="/building" 
        className={`fms-nav-item ${pathname === '/building' ? 'active' : ''}`}
      >
        {t.nav.building}
      </Link>
      <Link 
        href="/analytics" 
        className={`fms-nav-item ${pathname === '/analytics' ? 'active' : ''}`}
      >
        {t.nav.analytics}
      </Link>
    </nav>
  );
}
