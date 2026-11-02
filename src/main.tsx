import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Depois de uma atualização publicada, os arquivos de telas antigos deixam de
// existir. Se o navegador ainda estiver com a versão anterior aberta e tentar
// abrir uma tela, recarrega uma única vez para buscar a versão nova.
window.addEventListener('vite:preloadError', (event) => {
  const key = 'sstek:reloaded-after-deploy'
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})
window.addEventListener('load', () => {
  try {
    setTimeout(() => sessionStorage.removeItem('sstek:reloaded-after-deploy'), 10000)
  } catch {
    /* sem armazenamento: nada a limpar */
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
