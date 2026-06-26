import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { track } from './lib/analytics';

// 뒤로가기 처리를 위한 초기 history state
window.history.pushState({ page: 'init' }, '', '');

track('app_open');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
