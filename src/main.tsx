import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/inter/wght-italic.css'
import '@fontsource-variable/source-sans-3/wght.css'
import '@fontsource-variable/montserrat/wght.css'
import '@fontsource-variable/raleway/wght.css'
import '@fontsource-variable/nunito-sans/wght.css'
import '@fontsource-variable/work-sans/wght.css'
import '@fontsource-variable/dm-sans/wght.css'
import '@fontsource-variable/manrope/wght.css'
import '@fontsource-variable/oswald/wght.css'
import '@fontsource-variable/playfair-display/wght.css'
import '@fontsource-variable/lora/wght.css'
import '@fontsource-variable/eb-garamond/wght.css'
import '@fontsource-variable/source-serif-4/wght.css'
import '@fontsource-variable/roboto-slab/wght.css'
import '@fontsource/lato/400.css'
import '@fontsource/lato/700.css'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import './styles/app.css'
import './styles/doc.css'
import { App } from './App'
import { initPersistence } from './storage/sync'

void initPersistence()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js'))
}
