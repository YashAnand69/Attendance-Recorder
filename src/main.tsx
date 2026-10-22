import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {WorkspaceErrorBoundary} from './components/WorkspaceErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkspaceErrorBoundary><App /></WorkspaceErrorBoundary>
  </StrictMode>,
);
