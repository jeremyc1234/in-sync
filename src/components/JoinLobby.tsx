import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface JoinLobbyProps {
  onJoin: (lobbyCode: string, playerId: string, nickname: string) => void;
}

export default function JoinLobby({ onJoin }: JoinLobbyProps) {
  const [lobbyCode, setLobbyCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !lobbyCode.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      // Check if lobby exists and has space for more players
      const { data: lobby } = await supabase
        .from('lobbies')
        .select('code, max_players, players!inner(*)')
        .eq('code', lobbyCode.toUpperCase())
        .single();

      if (!lobby) {
        toast.error('Lobby not found');
        return;
      }

      if (lobby.players.length >= lobby.max_players) {
        toast.error('Lobby is full');
        return;
      }

      // Join lobby
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .insert([{ lobby_code: lobbyCode.toUpperCase(), nickname }])
        .select('id')
        .single();

      if (playerError) throw playerError;

      onJoin(lobbyCode.toUpperCase(), playerData.id, nickname);
      toast.success('Successfully joined the lobby!');
    } catch (error) {
      console.error('Error joining lobby:', error);
      toast.error('Failed to join lobby');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleJoin} className="space-y-4">
      <div>
        <label htmlFor="lobby-code" className="block text-sm font-medium text-gray-700">
          Lobby Code
        </label>
        <input
          type="text"
          id="lobby-code"
          value={lobbyCode}
          onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="Enter 5-digit code"
          maxLength={5}
          required
        />
      </div>
      <div>
        <label htmlFor="join-nickname" className="block text-sm font-medium text-gray-700">
          Your Nickname
        </label>
        <input
          type="text"
          id="join-nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="Enter your nickname"
          maxLength={20}
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {loading ? 'Joining...' : 'Join Lobby'}
      </button>
    </form>
  );
}