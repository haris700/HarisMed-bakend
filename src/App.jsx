import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Activity, PlusCircle, Search, MessageCircle, User, Sun, Moon, Stethoscope } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import AddReport from './pages/AddReport';
import History from './pages/History';
import Chat from './pages/Chat';
import Profile from './pages/Profile';

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('harismed-theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('harismed-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <Router>
      <header className="app-topbar">
        <div className="topbar-brand">
          <div className="brand-icon">
            <Stethoscope size={19} color="var(--teal)" />
          </div>
          <div>
            <span className="brand-title">HarisMed</span>
            <span className="brand-subtitle">Nephrology & Health Tracker</span>
          </div>
        </div>
        <button 
          onClick={toggleTheme} 
          className="theme-toggle-btn"
          aria-label="Toggle Theme"
        >
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
        </button>
      </header>

      <main className="page">
        <Routes>
          <Route path="/"        element={<Dashboard theme={theme} />} />
          <Route path="/add"     element={<AddReport theme={theme} />} />
          <Route path="/profile" element={<Profile theme={theme} />} />
          <Route path="/chat"    element={<Chat theme={theme} />} />
          <Route path="/history" element={<History theme={theme} />} />
        </Routes>
      </main>

      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Activity /><span>Overview</span>
        </NavLink>
        <NavLink to="/add" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <PlusCircle /><span>Add</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <User /><span>Profile</span>
        </NavLink>
        <NavLink to="/chat" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <MessageCircle /><span>HarisAI</span>
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Search /><span>History</span>
        </NavLink>
      </nav>
    </Router>
  );
}
