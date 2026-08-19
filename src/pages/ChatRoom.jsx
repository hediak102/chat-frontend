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

  const wsRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const chatWindowRef = useRef(null)

  useEffect(() => {
    loadHistory()
    connectWebSocket()

    return () => {
      wsRef.current?.close()
      clearTimeout(typingTimeoutRef.current)
    }
  }, [roomId])

  // Fait défiler vers le bas à chaque nouveau message
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight
    }
  }, [messages])

  const loadHistory = async () => {
    try {
      const response = await api.get(`/rooms/${roomId}/messages`)
      setMessages(
        response.data.map((m) => ({
          type: 'message',
          username: m.username,
          content: m.content,
        }))
      )
    } catch (err) {
      console.error("Impossible de charger l'historique", err)
    }
  }

  const connectWebSocket = () => {
    const token = localStorage.getItem('access_token')
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${roomId}?token=${token}`)

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'message') {
        setMessages((prev) => [...prev, data])
      } else if (data.type === 'user_joined' || data.type === 'user_left') {
        setMessages((prev) => [...prev, data])
        setOnlineUsers(data.online_users)
      } else if (data.type === 'typing') {
        setTypingUser(data.username)
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 2000)
      }
    }

    ws.onclose = () => {
      console.log('Connexion WebSocket fermée')
    }

    wsRef.current = ws
  }

  const sendMessage = (e) => {
    e.preventDefault()
    if (!input.trim()) return
    wsRef.current?.send(JSON.stringify({ type: 'message', content: input }))
    setInput('')
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

      <p className="online-users">En ligne: {onlineUsers.join(', ')}</p>

      <div className="chat-window" ref={chatWindowRef}>
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
            <p key={i} className="chat-message">
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