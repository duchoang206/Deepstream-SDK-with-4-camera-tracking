'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from './LanguageContext';

const BellIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
);

const UserIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const DocumentIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
);

export default function HeaderActions() {
  const { language, t, changeLanguage } = useLanguage();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="fms-actions">
      <button className="action-btn" title={t.header.alerts}><span style={{ color: '#ef4444' }}><BellIcon /></span></button>
      <button className="action-btn" title={t.header.documents}><DocumentIcon /></button>
      
      <div style={{ position: 'relative' }} ref={menuRef}>
        <button 
          className="action-btn lang-btn" 
          title={t.header.language} 
          onClick={() => setShowLangMenu(!showLangMenu)}
        >
          <span className="flag-uk">{language === 'en' ? '🇬🇧' : '🇻🇳'}</span>
        </button>
        
        {showLangMenu && (
          <div style={{
            position: 'absolute', top: '56px', right: '0', background: 'white', 
            border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            overflow: 'hidden', zIndex: 100, width: '180px'
          }}>
            <button 
              onClick={() => { changeLanguage('en'); setShowLangMenu(false); }}
              style={{
                width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
                background: language === 'en' ? '#f1f5f9' : 'transparent', border: 'none', cursor: 'pointer',
                textAlign: 'left', fontSize: '16px', color: '#334155', fontWeight: '500',
                borderBottom: '1px solid #e2e8f0'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = language === 'en' ? '#f1f5f9' : 'transparent'; }}
            >
              <span style={{ fontSize: '24px' }}>🇬🇧</span> English
            </button>
            <button 
              onClick={() => { changeLanguage('vi'); setShowLangMenu(false); }}
              style={{
                width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
                background: language === 'vi' ? '#f1f5f9' : 'transparent', border: 'none', cursor: 'pointer',
                textAlign: 'left', fontSize: '16px', color: '#334155', fontWeight: '500'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = language === 'vi' ? '#f1f5f9' : 'transparent'; }}
            >
              <span style={{ fontSize: '24px' }}>🇻🇳</span> Tiếng Việt
            </button>
          </div>
        )}
      </div>

      <button className="action-btn" title={t.header.profile}><UserIcon /></button>
    </div>
  );
}
