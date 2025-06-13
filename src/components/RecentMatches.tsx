import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Word {
  id: string;
  word: string;
  round: number;
  player_id: string;
  lobby_code: string;
}

interface Lobby {
  code: string;
  winner: string;
  rounds_taken: number;
  created_at: string;
}

interface RecentMatch {
  lobby: Lobby;
  words: Word[];
}

export default function RecentMatches() {
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentMatches = async () => {
      try {
        // Get recent winning lobbies
        const { data: lobbies } = await supabase
          .from('lobbies')
          .select('*')
          .not('winner', 'is', null)
          .order('created_at', { ascending: false })
          .limit(3);

        if (!lobbies) return;

        // For each lobby, get words
        const matches = await Promise.all(
          lobbies.map(async (lobby) => {
            const { data: words } = await supabase
              .from('words')
              .select('*')
              .eq('lobby_code', lobby.code)
              .order('round', { ascending: true });

            return {
              lobby,
              words: words || [],
            };
          })
        );

        setRecentMatches(matches);
      } catch (error) {
        console.error('Error fetching recent matches:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentMatches();
  }, []);

  if (loading) {
    return <div className="text-center text-gray-600">Loading recent matches...</div>;
  }

  if (recentMatches.length === 0) {
    return <div className="text-center text-gray-600">No recent matches found</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Recent Winning Matches</h2>
      <div className="space-y-4">
        {recentMatches.map((match) => {
          // Get starting words (round 1) and ending words (last round)
          const startingWords = match.words.filter(w => w.round === 1);
          const lastRound = Math.max(...match.words.map(w => w.round));
          const endingWords = match.words.filter(w => w.round === lastRound);

          return (
            <div key={match.lobby.code} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start mb-3">
                <p className="text-sm text-gray-500">
                  {new Date(match.lobby.created_at).toLocaleDateString()}
                </p>
                <p className="text-sm font-medium text-green-600">Synced in {match.lobby.rounds_taken} rounds!</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-2">
                  {startingWords.map((word) => (
                    <div
                      key={word.id}
                      className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800"
                    >
                      {word.word}
                    </div>
                  ))}
                </div>
                <span className="text-gray-400">→</span>
                <div className="px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                  {endingWords[0].word}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 