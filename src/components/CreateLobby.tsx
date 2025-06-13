import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Users } from 'lucide-react';

function generateLobbyCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

interface CreateLobbyProps {
  onJoin: (lobbyCode: string, playerId: string, nickname: string) => void;
}

export default function CreateLobby({ onJoin }: CreateLobbyProps) {
  const [nickname, setNickname] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [loading, setLoading] = useState(false);
  const [createdLobbyCode, setCreatedLobbyCode] = useState<string | null>(null);
  const [useTimer, setUseTimer] = useState(false);
  const [roundLimit, setRoundLimit] = useState(0);

  useEffect(() => {
    if (createdLobbyCode) {
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
      // 1) Create the new lobby with the chosen roundLimit
      const { error: lobbyError } = await supabase
        .from('lobbies')
        .insert([
          {
            code: lobbyCode,
            max_players: maxPlayers,
            use_timer: useTimer,
            round_limit: roundLimit, // Storing the round limit here
          },
        ]);

      if (lobbyError) throw lobbyError;

      // 2) Create the current player's record
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .insert([{ lobby_code: lobbyCode, nickname }])
        .select('id')
        .single();

      if (playerError) throw playerError;

      setCreatedLobbyCode(lobbyCode);
      onJoin(lobbyCode, playerData.id, nickname);

      toast.success('Lobby created! Share the code with your friends.');
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
      <div className="flex items-center justify-between">
        <div className="w-2/3">
          <label htmlFor="max-players" className="block text-sm font-medium text-gray-700">
            Number of Players
          </label>
          <select
            id="max-players"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            className="block w-full pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
          >
            <option value={2}>2 Players</option>
            <option value={3}>3 Players</option>
            <option value={4}>4 Players</option>
          </select>
        </div>
        <div className="w-1/3 flex flex-col items-end">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Timed Rounds
          </label>
          <button
            type="button"
            onClick={() => setUseTimer(!useTimer)}
            className={`${useTimer ? 'bg-green-600' : 'bg-gray-300'
              } relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
          >
            <span
              className={`${useTimer ? 'translate-x-6' : 'translate-x-1'
                } inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200`}
            />
          </button>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="round-limit" className="block text-sm font-medium text-gray-700">
            Round Limit
          </label>
          <select
            id="round-limit"
            value={roundLimit}
            onChange={(e) => setRoundLimit(Number(e.target.value))}
            className="block w-32 pr-3 py-2 text-base text-center border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
          >
            <option value={0}>∞</option>
            <option value={5}>5 Rounds</option>
            <option value={10}>10 Rounds</option>
            <option value={20}>20 Rounds</option>
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create New Lobby'}
      </button>
    </form>
  );
}