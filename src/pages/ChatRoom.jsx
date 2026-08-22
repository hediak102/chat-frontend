import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/axios'

function ChatRoom() {
  const { roomId } = useParams()
  const navigate = useNavigate()

  const [messages, setMessages] = useState([])
  const [onlineUsers, setOnlineUsers] = useState([])
  const [typingUser, setTypingUser] = useState(null)
  const [input, setInput] = useState('')
  const [currentUser, setCurrentUser] = useState('')

  // États pour la pagination
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const wsRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const chatWindowRef = useRef(null)
  const isInitialLoadRef = useRef(true)

  // Récupérer le nom d'utilisateur connecté au chargement
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await api.get('/me')
        setCurrentUser(response.data.username)
      } catch (err) {
        console.error("Impossible de récupérer l'utilisateur", err)
      }
    }
    fetchCurrentUser()
  }, [])

  useEffect(() => {
    setOnlineUsers([])
    setMessages([])
    setNextCursor(null)
    setHasMore(true)
    isInitialLoadRef.current = true

    loadHistory()
    fetchOnlineUsers()

    const token = localStorage.getItem('access_token')
    const wsBaseUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/^http/, 'ws')
    const ws = new WebSocket(`${wsBaseUrl}/ws/${roomId}?token=${token}`)

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'message') {
        setMessages((prev) => {
          if (data.tempId) {
            const existingIndex = prev.findIndex((m) => m.tempId === data.tempId)
            if (existingIndex !== -1) {
              const updated = [...prev]
              updated[existingIndex] = { ...data, pending: false }
              return updated
            }
          }
          return [...prev, data]
        })
      } else if (data.type === 'user_joined' || data.type === 'user_left') {
        setMessages((prev) => [...prev, data])
        if (Array.isArray(data.online_users)) {
          setOnlineUsers(data.online_users)
        }
      } else if (data.type === 'typing') {
        setTypingUser(data.username)
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 2000)
      } else if (data.type === 'stop_typing') {
        clearTimeout(typingTimeoutRef.current)
        setTypingUser((prev) => (prev === data.username ? null : prev))
      }
    }

    ws.onclose = () => {
      console.log('Connexion WebSocket fermée')
    }

    wsRef.current = ws

    return () => {
      ws.close()
      clearTimeout(typingTimeoutRef.current)
      setOnlineUsers([])
    }
  }, [roomId])

  useEffect(() => {
    if (chatWindowRef.current && isInitialLoadRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight
    }
  }, [messages])

  const loadHistory = async () => {
    try {
      const response = await api.get(`/rooms/${roomId}/messages?limit=20`)
      const { messages: newMessages, next_cursor, has_more } = response.data

      const formatted = newMessages.map((m) => ({
        type: 'message',
        username: m.username,
        content: m.content,
      }))

      setMessages(formatted)
      setNextCursor(next_cursor)
      setHasMore(has_more)

      requestAnimationFrame(() => {
        if (chatWindowRef.current) {
          chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight
        }
      })
    } catch (err) {
      console.error("Impossible de charger l'historique", err)
    }
  }

  const loadMoreMessages = async () => {
    if (!hasMore || loadingMore || !nextCursor) return

    setLoadingMore(true)
    isInitialLoadRef.current = false
    const container = chatWindowRef.current
    const previousScrollHeight = container.scrollHeight

    try {
      const response = await api.get(`/rooms/${roomId}/messages?limit=20&cursor=${nextCursor}`)
      const { messages: oldMessages, next_cursor, has_more } = response.data

      const formatted = oldMessages.map((m) => ({
        type: 'message',
        username: m.username,
        content: m.content,
      }))

      setMessages((prev) => [...formatted, ...prev])
      setNextCursor(next_cursor)
      setHasMore(has_more)

      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - previousScrollHeight
        }
      })
    } catch (err) {
      console.error("Impossible de charger l'historique ancien", err)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleScroll = () => {
    if (chatWindowRef.current.scrollTop === 0 && hasMore && !loadingMore) {
      loadMoreMessages()
    }
  }

  const fetchOnlineUsers = async () => {
    try {
      const response = await api.get(`/rooms/${roomId}/online-users`)
      setOnlineUsers(response.data)
    } catch (err) {
      console.error("Impossible de charger les utilisateurs en ligne", err)
    }
  }

  const sendMessage = (e) => {
    e.preventDefault()
    if (!input.trim()) return

    const messageText = input
    const tempId = crypto.randomUUID()
    isInitialLoadRef.current = true

    // 1. Ajout optimiste immédiat
    setMessages((prev) => [
      ...prev,
      {
        type: 'message',
        username: currentUser || 'Moi',
        content: messageText,
        tempId,
        pending: true,
      },
    ])

    setInput('')

    // 2. Envoi du message via WebSocket
    wsRef.current?.send(
      JSON.stringify({
        type: 'message',
        content: messageText,
        tempId,
      })
    )

    // 3. Notification explicite d'arrêt de saisie
    wsRef.current?.send(
      JSON.stringify({
        type: 'stop_typing',
      })
    )
  }

  const handleTyping = (e) => {
    setInput(e.target.value)
    wsRef.current?.send(JSON.stringify({ type: 'typing' }))
  }

  return (
    <div>
      <div className="chat-header">
        <button onClick={() => navigate('/rooms')}>← Retour aux salons</button>
        <h1>Salon #{roomId}</h1>
      </div>

      <p className="online-users">
        En ligne: {onlineUsers.length > 0 ? onlineUsers.join(', ') : 'Aucun utilisateur'}
      </p>

      <div className="chat-window" ref={chatWindowRef} onScroll={handleScroll}>
        {loadingMore && <p className="chat-system-message">Chargement des anciens messages...</p>}
        {!hasMore && <p className="chat-system-message">Début de la discussion</p>}

        {messages.map((m, i) => {
          if (m.type === 'user_joined')
            return (
              <p key={i} className="chat-system-message">
                🟢 {m.username} a rejoint
              </p>
            )
          if (m.type === 'user_left')
            return (
              <p key={i} className="chat-system-message">
                🔴 {m.username} a quitté
              </p>
            )
          return (
            <p
              key={m.tempId || i}
              className="chat-message"
              style={{ opacity: m.pending ? 0.6 : 1 }}
            >
              <strong>{m.username}:</strong> {m.content}
            </p>
          )
        })}
      </div>

      <p className="typing-indicator">
        {typingUser ? `${typingUser} est en train d'écrire...` : ''}
      </p>

      <form className="chat-input-form" onSubmit={sendMessage}>
        <input
          type="text"
          value={input}
          onChange={handleTyping}
          placeholder="Écris un message..."
          autoComplete="off"
        />
        <button type="submit">Envoyer</button>
      </form>
    </div>
  )
}

export default ChatRoom