import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

function generateLobbyCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

interface CreateLobbyProps {
  onJoin: (lobbyCode: string, playerId: string, nickname: string) => void;
}

export default function CreateLobby({ onJoin }: CreateLobbyProps) {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdLobbyCode, setCreatedLobbyCode] = useState<string | null>(null);

  useEffect(() => {
    if (createdLobbyCode) {
      // Subscribe to changes in the players table for this lobby
      const playersSubscription = supabase
        .channel('created-lobby-players')
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'players',
            filter: `lobby_code=eq.${createdLobbyCode}`
          },
          (payload) => {
            console.log('Players change detected:', payload);
          }
        )
        .subscribe();

      // Subscribe to changes in the lobby status
      const lobbySubscription = supabase
        .channel('created-lobby-status')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'lobbies',
            filter: `code=eq.${createdLobbyCode}`
          },
          (payload) => {
            console.log('Lobby status change detected:', payload);
          }
        )
        .subscribe();

      return () => {
        playersSubscription.unsubscribe();
        lobbySubscription.unsubscribe();
      };
    }
  }, [createdLobbyCode]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      toast.error('Please enter a nickname');
      return;
    }

    setLoading(true);
    const lobbyCode = generateLobbyCode();

    try {
      // Create lobby
      const { error: lobbyError } = await supabase
        .from('lobbies')
        .insert([{ code: lobbyCode }]);

      if (lobbyError) throw lobbyError;

      // Create player
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .insert([{ lobby_code: lobbyCode, nickname }])
        .select('id')
        .single();

      if (playerError) throw playerError;

      setCreatedLobbyCode(lobbyCode);
      onJoin(lobbyCode, playerData.id, nickname);
      toast.success('Lobby created! Share the code with your friend.');
    } catch (error) {
      console.error('Error creating lobby:', error);
      toast.error('Failed to create lobby');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleCreate} className="space-y-4">
      <div>
        <label htmlFor="create-nickname" className="block text-sm font-medium text-gray-700">
          Your Nickname
        </label>
        <input
          type="text"
          id="create-nickname"
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
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create New Lobby'}
      </button>
    </form>
  );
}