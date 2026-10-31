import React from 'react';
import { AppProvider } from './context/AppContext';
import { AppContent } from './AppContent';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

export function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;

