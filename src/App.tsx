import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play, Pause, Volume2, Info, List, ChevronDown, ChevronUp, Sparkles, Settings2, Clock, Radio,
  TerminalSquare, CheckCircle2, Loader2, Bot, Download, Lock, Key, ShieldAlert, Check,
  HelpCircle, User, AlertCircle, RefreshCw, Trash2, ChevronLeft, Share2, Copy, ExternalLink, Globe
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { MOCK_SHOW, transformShow } from './transform';
import { Transcript } from './components/Transcript';
import { saveUserShow, getUserShows, deleteUserShow } from './db';
import { RadioShow } from './types';

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

const RainbowBackground = () => (
  <>
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vh] rounded-full bg-[#ff00a2]/40 mix-blend-screen filter blur-[120px] animate-blob" />
      <div className="absolute top-[10%] -right-[10%] w-[60vw] h-[60vh] rounded-full bg-[#143dff]/40 mix-blend-screen filter blur-[120px] animate-blob animation-delay-2000" />
      <div className="absolute -bottom-[20%] left-[10%] w-[70vw] h-[70vh] rounded-full bg-[#43ff0d]/30 mix-blend-screen filter blur-[120px] animate-blob animation-delay-4000" />
      <div className="absolute -bottom-[10%] -right-[10%] w-[60vw] h-[60vh] rounded-full bg-[#ffc500]/30 mix-blend-screen filter blur-[120px] animate-blob animation-delay-6000" />
      <div className="absolute top-[30%] left-[30%] w-[50vw] h-[50vh] rounded-full bg-[#ff2a2a]/30 mix-blend-screen filter blur-[120px] animate-blob animation-delay-3000" />
    </div>
    <div className="absolute inset-0 bg-black/50 backdrop-blur-[60px] z-0 pointer-events-none" />
  </>
);

export default function App() {
  const [view, setView] = useState<'home' | 'player' | 'generating'>('home');
  const [selectedShow, setSelectedShow] = useState<RadioShow>(MOCK_SHOW);
  const [library, setLibrary] = useState<RadioShow[]>([MOCK_SHOW]);

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [targetDuration, setTargetDuration] = useState('3');
  const [targetMood, setTargetMood] = useState('Informative');

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Load library from local DB
  useEffect(() => {
    getUserShows().then((shows) => {
      if (shows && shows.length > 0) {
        setLibrary([MOCK_SHOW, ...shows]);
      }
    });
  }, []);

  // Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error("Sign-in failed", e);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Sign-out failed", e);
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleDeleteShow = async (title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteUserShow(title);
    setLibrary((prev) => prev.filter((s) => s.title !== title));
    if (selectedShow.title === title) {
      setSelectedShow(MOCK_SHOW);
      setView('home');
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0a0a0c] text-white flex flex-col font-sans overflow-x-hidden selection:bg-io-blue/30 selection:text-white">
      <RainbowBackground />

      {/* Audio Engine */}
      <audio
        ref={audioRef}
        src={selectedShow.audioUrl}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Navigation Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 backdrop-blur-md bg-black/20">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('home')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-io-blue via-io-green to-io-yellow flex items-center justify-center p-[2px]">
            <div className="w-full h-full bg-black/80 rounded-[10px] flex items-center justify-center">
              <Radio className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">radio.agent</h1>
            <p className="text-xs text-neutral-400">AI Talk Radio Generator</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt="Avatar" className="w-6 h-6 rounded-full" />
              ) : (
                <User className="w-4 h-4 text-neutral-300" />
              )}
              <span className="text-xs font-medium">{currentUser.displayName || currentUser.email}</span>
              <button
                onClick={handleSignOut}
                className="text-xs text-neutral-400 hover:text-white ml-2 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className="text-xs font-medium bg-white text-black px-4 py-2 rounded-full hover:bg-neutral-200 transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col max-w-6xl w-full mx-auto p-6 md:p-8">
        {view === 'home' && (
          <div className="flex flex-col gap-10">
            {/* Prompt Generator Hero */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-xl">
              <h2 className="text-2xl font-bold mb-2">Create a New Radio Show</h2>
              <p className="text-sm text-neutral-400 mb-6">
                Enter a topic, current event, GitHub repository, or URL to generate a dynamic talk radio show.
              </p>

              <div className="flex flex-col gap-4">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Discuss the latest breakthroughs in fusion energy and the open problems..."
                  className="w-full h-28 bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-io-blue transition-colors resize-none"
                />

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
                    >
                      <Settings2 className="w-4 h-4" />
                      Options
                    </button>
                  </div>

                  <button
                    disabled={!prompt.trim() || isGenerating}
                    onClick={() => setView('player')}
                    className="flex items-center gap-2 bg-gradient-to-r from-io-blue to-io-green text-white font-medium text-sm px-6 py-2.5 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Show
                  </button>
                </div>
              </div>
            </div>

            {/* Show Library */}
            <div>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <List className="w-5 h-5 text-io-blue" />
                Featured & Saved Shows
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {library.map((show, idx) => (
                  <div
                    key={`${show.title}-${idx}`}
                    onClick={() => {
                      setSelectedShow(show);
                      setView('player');
                    }}
                    className="group bg-white/[0.02] border border-white/10 hover:border-white/20 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 backdrop-blur-md"
                  >
                    <div className="relative h-44 w-full overflow-hidden">
                      <img
                        src={show.coverImage}
                        alt={show.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                        <span className="text-xs bg-black/60 backdrop-blur-md px-2 py-1 rounded text-neutral-300 font-mono">
                          {Math.floor(show.duration / 60)}:{(show.duration % 60).toString().padStart(2, '0')}
                        </span>
                        {show.isUserGenerated && (
                          <button
                            onClick={(e) => handleDeleteShow(show.title, e)}
                            className="p-1.5 bg-black/60 rounded-full hover:bg-red-500/80 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-white" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-4">
                      <h4 className="font-semibold text-sm line-clamp-1 mb-1 group-hover:text-io-blue transition-colors">
                        {show.title}
                      </h4>
                      <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                        {show.summary}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'player' && (
          <div className="flex-1 flex flex-col gap-6">
            <button
              onClick={() => setView('home')}
              className="self-start flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Library
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-220px)]">
              {/* Left Column: Player & Metadata */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                  <img
                    src={selectedShow.coverImage}
                    alt={selectedShow.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-io-green mb-1 block">
                      Host: {selectedShow.host}
                    </span>
                    <h2 className="text-xl font-bold leading-tight mb-2">{selectedShow.title}</h2>
                    <p className="text-xs text-neutral-300 line-clamp-2">{selectedShow.summary}</p>
                  </div>
                </div>

                {/* Controls */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                  <input
                    type="range"
                    min={0}
                    max={selectedShow.duration || 100}
                    value={currentTime}
                    onChange={(e) => handleSeek(Number(e.target.value))}
                    className="w-full accent-io-blue cursor-pointer"
                  />
                  <div className="flex justify-between items-center text-xs font-mono text-neutral-400">
                    <span>
                      {Math.floor(currentTime / 60)}:{(Math.floor(currentTime) % 60).toString().padStart(2, '0')}
                    </span>
                    <span>
                      {Math.floor(selectedShow.duration / 60)}:{(selectedShow.duration % 60).toString().padStart(2, '0')}
                    </span>
                  </div>

                  <div className="flex justify-center items-center gap-6 mt-2">
                    <button
                      onClick={togglePlay}
                      className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-black ml-0.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Synchronized Interactive Transcript */}
              <div className="lg:col-span-7 bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <List className="w-4 h-4 text-io-blue" />
                    Live Show Transcript
                  </h3>
                  <span className="text-xs text-neutral-500 font-mono">
                    {selectedShow.transcript.length} turns
                  </span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <Transcript
                    transcript={selectedShow.transcript}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
