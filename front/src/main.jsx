//src/main.jsx

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './styles/dms-html.css'
import './styles/scrollbar.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* фон/цвет вынесены в корневой контейнер App */}
    <App />
  </StrictMode>,
)
