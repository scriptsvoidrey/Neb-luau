import { createRoot } from 'react-dom/client'
import '@fontsource-variable/dm-sans'
import '@fontsource-variable/manrope'
import '@fontsource/jetbrains-mono/400.css'
import './styles/app.css'
import App from './App'

createRoot(document.getElementById('root')!).render(<App />)
