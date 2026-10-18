import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const appBase = import.meta.env.BASE_URL
if (window.location.pathname !== appBase || window.location.search || window.location.hash) {
  window.history.replaceState(window.history.state, '', appBase)
}

createRoot(document.getElementById('root')).render(<App />)
