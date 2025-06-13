import React, { useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import CreateLobby from './components/CreateLobby';
import JoinLobby from './components/JoinLobby';
import Game from './components/Game';
import RecentMatches from './components/RecentMatches';

function App() {
  const [gameState, setGameState] = useState<{
    lobbyCode?: string;
    playerId?: string;
    nickname?: string;
  }>({});
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(true);

  const handleJoinGame = (lobbyCode: string, playerId: string, nickname: string) => {
    setGameState({ lobbyCode, playerId, nickname });
  };

  if (gameState.lobbyCode && gameState.playerId) {
    return (
      <Game
        lobbyCode={gameState.lobbyCode}
        playerId={gameState.playerId}
        nickname={gameState.nickname!}
        onExit={() => setGameState({})}
        onJoin={handleJoinGame}
      />
    );
  }

  return (
    <div className="min-h-screen bg-animated-gradient flex items-center justify-center p-4">
      <Toaster position="top-center" />
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-4">
          <img src='/icons/WordSyncedLogo.svg' alt="Word Synced Logo" className="w-20 h-20 mr-2" />
          <h1 className="text-3xl font-bold text-gray-800">Word Synced</h1>
        </div>

        <div className="mb-4 text-center">
          <button
            onClick={() => setShowHowToPlay(!showHowToPlay)}
            className="py-1 px-4 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700"
          >
            {showHowToPlay ? 'Close' : 'How to Play 🙋'}
          </button>
        </div>

        {showHowToPlay && (
          <div className="bg-gray-100 p-4 rounded-lg mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">How to Play</h3>
            <p className="text-sm text-gray-700 mb-2">
              <strong>What it is:</strong> A cooperative game where players try to enter the same word at the same time.
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Best for:</strong> Two players minimum. It&apos;s more challenging with more.
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <strong>How to play:</strong> Start by typing any random word. Then, try to type the same word as your partner(s) in subsequent rounds by finding a connection or commonality between the previous words.
            </p>
            <p className="text-sm text-gray-700">
              For example: If one says "beach" and the other says "wave", the next round might lead to "surfboard" or "water". The goal is to match words as quickly as possible!
            </p>
          </div>
        )}

        <div className="flex justify-center mb-6">
          <div className="bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setIsCreateMode(true)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isCreateMode ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Create Lobby
            </button>
            <button
              onClick={() => setIsCreateMode(false)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                !isCreateMode ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Join Lobby
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {isCreateMode ? (
            <CreateLobby onJoin={handleJoinGame} />
          ) : (
            <JoinLobby onJoin={handleJoinGame} />
          )}
        </div>

        <div className="mt-8">
          <RecentMatches />
        </div>
      </div>
    </div>
  );
}

export default App;