import React from 'react';
import { AppProvider } from './context/AppContext';
import { AppContent } from './AppContent';
import './index.css';

export function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
