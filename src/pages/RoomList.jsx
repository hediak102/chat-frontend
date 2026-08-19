import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

function RoomList() {
  const [rooms, setRooms] = useState([])
  const [name, setName] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchRooms()
  }, [])

  const fetchRooms = async () => {
    const response = await api.get('/rooms')
    setRooms(response.data)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    await api.post('/rooms', { name })
    setName('')
    fetchRooms()
  }

  return (
    <div>
      <h1>Salons</h1>
      <form onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Nom du salon"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit">Créer</button>
      </form>
      <ul>
        {rooms.map((room) => (
          <li key={room.id}>
            <button onClick={() => navigate(`/rooms/${room.id}`)}>
              {room.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default RoomList