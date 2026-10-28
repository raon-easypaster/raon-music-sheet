import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { registerServiceWorker } from './utils/offline'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)

// 배포된 화면에서만 오프라인 저장(서비스 워커)을 켠다
if (import.meta.env.PROD) registerServiceWorker()
