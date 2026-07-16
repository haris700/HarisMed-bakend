import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Activity, PlusCircle, Search, MessageCircle } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import AddReport from './pages/AddReport';
import History from './pages/History';
import Chat from './pages/Chat';

export default function App() {
  return (
    <Router>
      <main className="page">
        <Routes>
          <Route path="/"       element={<Dashboard />} />
          <Route path="/add"    element={<AddReport />} />
          <Route path="/history" element={<History />} />
          <Route path="/chat"   element={<Chat />} />
        </Routes>
      </main>

      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Activity /><span>Overview</span>
        </NavLink>
        <NavLink to="/add" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <PlusCircle /><span>Add</span>
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
