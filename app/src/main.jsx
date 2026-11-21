import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import './fonts.css';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')).render(
  <MotionConfig reducedMotion="user">
    <App />
  </MotionConfig>,
);
