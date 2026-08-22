import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
})

// Ajoute automatiquement le token à chaque requête sortante
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Si une requête échoue avec 401 (token expiré), tente un refresh automatique
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const baseURL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
          const res = await axios.post(`${baseURL}/refresh`, {
            refresh_token: refreshToken,
          })
          localStorage.setItem('access_token', res.data.access_token)
          originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`
          return api(originalRequest)
        } catch {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

// --- Fonctions d'appel API ---

export const fetchRoomMessages = async (roomId, limit = 20, cursor = null) => {
  const params = { limit }
  if (cursor) {
    params.cursor = cursor
  }
  const response = await api.get(`/rooms/${roomId}/messages`, { params })
  return response.data // Renvoie { messages, next_cursor, has_more }
}

export default api