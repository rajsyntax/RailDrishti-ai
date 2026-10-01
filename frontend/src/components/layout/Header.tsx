import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Train, Radio, Building2, BarChart3, Languages, Menu, X } from 'lucide-react';
import { PrototypeBadge } from '../common/PrototypeBadge';
import { LiveStatusBadge } from '../common/LiveStatusBadge';

export const Header: React.FC = () => {
  const [lang, setLang] = useState<'EN' | 'HI'>('EN');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleLanguage = () => {
    setLang(prev => prev === 'EN' ? 'HI' : 'EN');
  };

  const navItems = [
    { to: '/passenger', label: lang === 'EN' ? 'Passenger' : 'यात्री', icon: Train },
    { to: '/control', label: lang === 'EN' ? 'Control Center' : 'नियंत्रण कक्ष', icon: Radio },
    { to: '/station', label: lang === 'EN' ? 'Station Operations' : 'स्टेशन परिचालन', icon: Building2 },
    { to: '/admin', label: lang === 'EN' ? 'Analytics & AI' : 'एनालिटिक्स', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0B1F3A] text-white border-b border-blue-900/50 shadow-md">
      {/* Top micro banner for SIH prototype awareness */}
      <div className="bg-slate-950/60 px-4 py-1 text-[11px] text-slate-300 text-center flex items-center justify-center gap-2 border-b border-slate-800">
        <span className="font-semibold text-blue-400">SIH 2024–26 Innovation:</span>
        <span className="truncate">Explainable AI Railway ETA Prediction & Operations Intelligence Platform</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-teal-400 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Train className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-teal-200">
                  RailDrishti
                </span>
                <span className="px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 text-[10px] font-bold border border-teal-500/40">
                  AI
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">Indian Railways Operational ETA</p>
            </div>
          </Link>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-blue-600/90 text-white shadow-sm shadow-blue-500/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 opacity-80" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5">
            <LiveStatusBadge />
            <PrototypeBadge />

            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
              title="Toggle Language Display"
            >
              <Languages className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-mono text-[11px] font-bold">{lang === 'EN' ? 'EN' : 'हिन्दी'}</span>
            </button>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-[#071324] px-4 pt-2 pb-4 space-y-1 animate-fade-in">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </header>
  );
};
