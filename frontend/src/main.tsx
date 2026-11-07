import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initTheme } from './stores/themeStore';
import { startSessionLifecycle } from './session/lifecycle';

initTheme();
startSessionLifecycle();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);