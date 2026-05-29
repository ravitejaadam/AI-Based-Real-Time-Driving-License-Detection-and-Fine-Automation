import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Monitoring from './pages/Monitoring';

// Placeholder components for other pages
const Placeholder = ({ title }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
    <h1 className="text-2xl font-bold mb-2">{title}</h1>
    <p>This module is part of future implementation phases.</p>
  </div>
);

const App = () => {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/monitoring" element={<Monitoring />} />
        <Route path="/violations" element={<Placeholder title="Violations Management" />} />
        <Route path="/vehicles" element={<Placeholder title="Vehicle Database" />} />
        <Route path="/analytics" element={<Placeholder title="Advanced Analytics" />} />
        <Route path="/notifications" element={<Placeholder title="Notification Center" />} />
        <Route path="/settings" element={<Placeholder title="System Settings" />} />
      </Routes>
    </MainLayout>
  );
};

export default App;
