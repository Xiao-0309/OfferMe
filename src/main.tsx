/* Modified for OfferMe (2026); derived from MeetingCopilot. See UPSTREAM.md. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './design/brand.css';
import './design/interview.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
