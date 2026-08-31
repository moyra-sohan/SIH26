import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { FloodDataProvider } from './context/FloodDataContext.jsx';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <FloodDataProvider>
        <App />
      </FloodDataProvider>
    </AuthProvider>
  </BrowserRouter>
);
