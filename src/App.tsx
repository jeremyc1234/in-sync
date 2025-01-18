import React, { useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import CreateLobby from './components/CreateLobby';
import JoinLobby from './components/JoinLobby';
import Game from './components/Game';

function App() {
  const [gameState, setGameState] = useState<{
    lobbyCode?: string;
    playerId?: string;
    nickname?: string;
  }>({});
  const [showHowToPlay, setShowHowToPlay] = useState(false);
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
        onJoin={handleJoinGame} // <-- pass the same join logic down
      />
    );
  }
  return (
    <div className="min-h-screen bg-gray-800 flex items-center justify-center p-4">
      <Toaster position="top-center" />
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-4">
          <img src="src/icons/WordSyncedLogo.svg" alt="Word Synced Logo" className="w-20 h-20 mr-2" />
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
              <strong>How to play:</strong> Start by typing any random word simultaneously. Then, try to type the same word in subsequent rounds by finding a connection or commonality between the previous words.
            </p>
            <p className="text-sm text-gray-700">
              For example: If one says "beach" and the other says "wave", the next round might lead to "surfboard" or "water." The goal is to match words as quickly as possible!
            </p>
          </div>
        )}

        <div className="space-y-6">
          <CreateLobby onJoin={handleJoinGame} />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>
          <JoinLobby onJoin={handleJoinGame} />
        </div>
      </div>

    </div>
  );
}

export default App;