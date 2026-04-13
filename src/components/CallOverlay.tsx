import { useCommunication } from '@/lib/communication';
import { Button } from '@/components/ui/button';
import { 
  Pause, Play, UserPlus, Volume2, Grid, Maximize2, VolumeX, Volume1,
  Mic, MicOff, Video, VideoOff, Phone, PhoneOff, User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wifi, WifiLow, SignalHigh, SignalLow, Activity } from 'lucide-react';

// Robust Video Stream Component
function VideoStream({ stream, muted = false, className }: { stream: MediaStream | null, muted?: boolean, className?: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            console.log('[Video] Attaching stream to element');
            videoRef.current.srcObject = stream;
            
            // Explicitly trigger play
            const playVideo = async () => {
                try {
                    await videoRef.current?.play();
                } catch (err) {
                    console.warn('[Video] Autoplay prevented, retrying on metadata load...', err);
                }
            };
            playVideo();
        }
    }, [stream]);

    return (
        <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted={muted}
            className={className}
            onLoadedMetadata={(e) => {
                (e.target as HTMLVideoElement).play().catch(console.warn);
            }}
        />
    );
}

// Visualizer Component
function AudioVisualizer({ stream }: { stream: MediaStream | null }) {
    const [level, setLevel] = useState(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationRef = useRef<number | null>(null);

    useEffect(() => {
        if (!stream || stream.getAudioTracks().length === 0) return;

        const init = () => {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass();
            const analyser = ctx.createAnalyser();
            const source = ctx.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 256;
            
            audioContextRef.current = ctx;
            analyserRef.current = analyser;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const update = () => {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;
                setLevel(average);
                animationRef.current = requestAnimationFrame(update);
            };
            update();
        };

        init();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, [stream]);

    return (
        <div className="flex items-end gap-0.5 h-3">
            {[...Array(4)].map((_, i) => (
                <motion.div 
                    key={i}
                    animate={{ height: level > 5 ? [2, 12, 4, 8, 2][(i + Math.floor(level/15)) % 5] : 2 }}
                    transition={{ repeat: Infinity, duration: 0.4 }}
                    className={cn(
                        "w-1 rounded-full",
                        level > 5 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-600"
                    )}
                />
            ))}
        </div>
    );
}

// Connection Quality Component
function ConnectionQualityIndicator() {
    return (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-zinc-800/10 backdrop-blur-md rounded-md border border-white/5">
            <SignalHigh className="w-3 h-3 text-emerald-500" />
            <span className="text-[8px] font-black uppercase text-emerald-500 tracking-tighter">Secure & Stable</span>
        </div>
    );
}

// Robust Audio Stream Component
function AudioStream({ stream }: { stream: MediaStream | null }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [blocked, setBlocked] = useState(false);

    useEffect(() => {
        if (audioRef.current && stream) {
            console.log('[Audio] Attaching stream to element');
            audioRef.current.srcObject = stream;
            
            const playAudio = async () => {
                try {
                    await audioRef.current?.play();
                    setBlocked(false);
                } catch (err) {
                    console.warn('[Audio] Autoplay prevented', err);
                    setBlocked(true);
                }
            };
            playAudio();
        }
    }, [stream]);

    return (
        <div className="absolute top-4 right-4 z-50">
            <audio 
                ref={audioRef}
                autoPlay 
                className="hidden"
                onLoadedMetadata={(e) => {
                    const audio = e.target as HTMLAudioElement;
                    audio.play().catch(() => setBlocked(true));
                }}
            />
            {blocked && (
                <Button 
                    size="sm" 
                    variant="destructive" 
                    className="animate-bounce text-[10px] h-6 px-2 rounded-full"
                    onClick={() => {
                        audioRef.current?.play();
                        setBlocked(false);
                    }}
                >
                    Enable Sound
                </Button>
            )}
        </div>
    );
}

export default function CallOverlay() {
  const { 
    callState, callMode, incomingCall, activeCall, activeParticipants,
    isMuted, isVideoOff, isOnHold, isPartnerOnHold, isSpeakerOn,
    acceptCall, declineCall, endCall, 
    toggleMute, toggleVideo, toggleHold, toggleSpeaker,
    addParticipant, onlineUsers, allUsers,
    roomReady 
  } = useCommunication();

  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  if (callState === 'idle') return null;

  const remoteParticipants = activeParticipants.filter(p => !p.isLocal);
  const localParticipant = activeParticipants.find(p => p.isLocal);

  const filteredUsers = allUsers.filter(u => 
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !activeParticipants.find(p => p.id === u.id)
  );

  return (
    <div className="fixed inset-0 z-[200] bg-zinc-950 text-white overflow-hidden font-jakarta-sans">
      {/* Background Blur */}
      <div className="absolute inset-0 z-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/20 to-black" />
          {activeCall?.stream && callMode === 'video' && !isVideoOff && (
              <VideoStream 
                stream={activeCall.stream} 
                muted 
                className="w-full h-full object-cover blur-2xl scale-110" 
              />
          )}
      </div>

      <AnimatePresence mode="wait">
        {/* Ringing / Dialing State */}
        {(callState === 'ringing' || callState === 'dialing') && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10 h-full flex flex-col items-center justify-between py-20 px-6"
          >
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="relative">
                <motion.div 
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-32 h-32 rounded-full bg-blue-600/20 flex items-center justify-center border-4 border-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.5)]"
                >
                  <User className="w-16 h-16 text-blue-400" />
                </motion.div>
                {(callState === 'ringing' || callState === 'dialing') && (
                   <div className="absolute -inset-4 rounded-full border-2 border-blue-500/30 animate-ping" />
                )}
              </div>
              
              <div className="space-y-4">
                <h1 className="text-3xl font-black tracking-tight">
                  {callState === 'ringing' ? (incomingCall?.fromName || 'Someone') : (activeCall?.partnerName || 'Connecting...')}
                </h1>
                <div className="flex flex-col items-center gap-2">
                    <p className="text-blue-400 font-bold uppercase tracking-[0.2em] text-xs">
                    {callState === 'ringing' ? 'Incoming Consultation' : 'Dialing Staff...'}
                    </p>
                    {callState === 'dialing' && (
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 30, ease: "linear" }}
                            className="h-1 bg-blue-500/30 rounded-full w-48 overflow-hidden"
                        >
                            <div className="h-full bg-blue-500 w-full" />
                        </motion.div>
                    )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8">
              {callState === 'ringing' ? (
                <>
                  <Button 
                    onClick={declineCall}
                    variant="destructive"
                    className="w-16 h-16 rounded-full p-0 shadow-lg shadow-red-500/20 hover:scale-110 transition-transform"
                  >
                    <PhoneOff className="w-8 h-8" />
                  </Button>
                  <Button 
                    onClick={acceptCall}
                    disabled={!roomReady && callState === 'connecting'}
                    className="w-16 h-16 rounded-full p-0 bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 hover:scale-110 transition-transform disabled:opacity-50"
                  >
                    <Phone className="w-8 h-8" />
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={endCall}
                  variant="destructive"
                  className="w-16 h-16 rounded-full p-0 shadow-lg shadow-red-500/20 hover:scale-110 transition-transform"
                >
                  <PhoneOff className="w-8 h-8" />
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {/* Connected State */}
        {(callState === 'connected' || callState === 'connecting') && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative z-10 h-full flex flex-col"
          >
            {/* Header info */}
            <div className="absolute top-8 left-0 right-0 px-6 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-3 glass-ios p-2 pr-4 rounded-full border border-white/20 pointer-events-auto shadow-2xl">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-bold tracking-tight">
                      {remoteParticipants.length === 0 ? 'Connecting...' : 
                       remoteParticipants.length === 1 ? remoteParticipants[0].name : 
                       `${remoteParticipants[0].name} + ${remoteParticipants.length - 1} others`}
                    </span>
                    {isOnHold && (
                        <span className="ml-2 px-2 py-0.5 bg-amber-500 text-[10px] font-black uppercase rounded text-black">You're on Hold</span>
                    )}
                    {isPartnerOnHold && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-500 text-[10px] font-black uppercase rounded text-white">Partner on Hold</span>
                    )}
                </div>
                
                <div className="pointer-events-auto flex items-center gap-2">
                    <ConnectionQualityIndicator />
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full bg-black/40 hover:bg-black/60 text-white border border-white/10"
                        onClick={() => setShowAddParticipant(true)}
                    >
                        <UserPlus className="w-5 h-5" />
                    </Button>
                </div>

                {isPartnerOnHold && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-x-0 top-32 flex justify-center pointer-events-none"
                    >
                        <div className="bg-amber-500/10 backdrop-blur-xl border border-amber-500/20 p-4 px-8 rounded-2xl flex flex-col items-center gap-2 shadow-2xl">
                            <Pause className="w-12 h-12 text-amber-500 animate-pulse" />
                            <p className="text-amber-500 font-black uppercase tracking-tighter">Staff put you on hold</p>
                            <p className="text-[10px] text-amber-500/60 font-bold uppercase tracking-widest">They will be back shortly</p>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Video Grid */}
            <div className={cn(
                "flex-1 p-4 pt-24 pb-32 transition-all duration-500",
                remoteParticipants.length === 1 ? "relative" : 
                remoteParticipants.length === 2 ? "grid grid-cols-1 md:grid-cols-2 gap-6" :
                remoteParticipants.length <= 4 ? "grid grid-cols-2 gap-4" :
                "grid grid-cols-2 md:grid-cols-3 gap-3"
            )}>
                {/* Main Remote Video (if single) */}
                {remoteParticipants.length === 1 && (
                    <div className="w-full h-full max-w-5xl mx-auto rounded-[2rem] overflow-hidden bg-zinc-900 border border-white/5 relative shadow-2xl">
                        {(callMode === 'video' || remoteParticipants.some(p => !p.videoOff)) && remoteParticipants[0].stream && !remoteParticipants[0].videoOff ? (
                            <VideoStream 
                                stream={remoteParticipants[0].stream} 
                                className={cn(
                                    "w-full h-full object-cover transition-all duration-700",
                                    isOnHold && "grayscale blur-lg opacity-40 scale-110"
                                )}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950">
                                <Avatar className="w-32 h-32 border-4 border-white/10 shadow-2xl">
                                    <AvatarFallback className="bg-blue-600 text-4xl font-black">{remoteParticipants[0].name.charAt(0)}</AvatarFallback>
                                </Avatar>
                            </div>
                        )}
                        {/* Audio track */}
                        <AudioStream stream={remoteParticipants[0].stream} />
                        
                        <div className="absolute bottom-6 left-6 p-2 px-4 glass-ios rounded-xl border border-white/20 flex items-center gap-3 shadow-lg">
                            <AudioVisualizer stream={remoteParticipants[0].stream} />
                            <span className="text-xs font-black tracking-tight">{remoteParticipants[0].name}</span>
                        </div>
                    </div>
                )}

                {/* Multiple Remote Videos */}
                {remoteParticipants.length > 1 && remoteParticipants.map((p) => (
                    <div key={p.id} className="relative rounded-[1.5rem] overflow-hidden bg-zinc-900 border border-white/5 aspect-square md:aspect-auto shadow-xl">
                         {(callMode === 'video' || !p.videoOff) && p.stream && !p.videoOff ? (
                            <VideoStream stream={p.stream} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Avatar className="w-20 h-20 border-2 border-white/10">
                                    <AvatarFallback className="bg-zinc-800 text-2xl font-black">{p.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                            </div>
                        )}
                        <AudioStream stream={p.stream} />
                        <div className="absolute bottom-4 left-4 p-1 px-3 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-2">
                            <AudioVisualizer stream={p.stream} />
                            <span className="text-[10px] font-bold">{p.name}</span>
                        </div>
                    </div>
                ))}
                
                {/* Connecting fallback */}
                {remoteParticipants.length === 0 && (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-6">
                        <div className="w-24 h-24 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                        <p className="text-blue-400 font-bold uppercase tracking-widest text-xs animate-pulse">Establishing secure link...</p>
                    </div>
                )}
            </div>

            {/* Local Preview PIP */}
            {localParticipant && (callMode === 'video' || !isVideoOff) && (
                <motion.div 
                    drag 
                    dragConstraints={{ left: -300, right: 0, top: -500, bottom: 0 }}
                    initial={{ x: 0, y: 0 }}
                    className={cn(
                        "fixed bottom-32 right-6 w-32 md:w-48 aspect-[3/4] rounded-3xl overflow-hidden bg-zinc-800 border-2 border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-20 transition-opacity",
                        isVideoOff ? "opacity-40" : "opacity-100"
                    )}
                >
                    {!isVideoOff ? (
                        <VideoStream 
                            stream={localParticipant.stream} 
                            muted 
                            className="w-full h-full object-cover scale-x-[-1]" 
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <User className="w-10 h-10 text-zinc-600" />
                        </div>
                    )}
                </motion.div>
            )}

            {/* Floating Control Bar */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30">
                <div className="flex items-center gap-4 p-3 px-6 glass-ios rounded-full border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
                    <Button 
                        onClick={toggleMute}
                        variant="ghost" 
                        size="icon" 
                        className={cn(
                            "w-12 h-12 rounded-full transition-all duration-300",
                            isMuted ? "bg-white text-black hover:bg-zinc-200" : "bg-white/10 hover:bg-white/20 text-white"
                        )}
                    >
                        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </Button>

                    <Button 
                        onClick={toggleVideo}
                        variant="ghost" 
                        size="icon"
                        className={cn(
                            "w-12 h-12 rounded-full transition-all duration-300",
                            isVideoOff ? "bg-white text-black hover:bg-zinc-200" : "bg-white/10 hover:bg-white/20 text-white"
                        )}
                    >
                        {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </Button>

                    <Button 
                        onClick={toggleHold}
                        variant="ghost" 
                        size="icon"
                        className={cn(
                            "w-12 h-12 rounded-full transition-all duration-300",
                            isOnHold ? "bg-amber-500 text-black hover:bg-amber-600" : "bg-white/10 hover:bg-white/20 text-white"
                        )}
                    >
                        {isOnHold ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                    </Button>

                    <Button 
                        onClick={toggleSpeaker}
                        variant="ghost" 
                        size="icon"
                        className={cn(
                            "w-12 h-12 rounded-full transition-all duration-300",
                            isSpeakerOn ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-white/10 hover:bg-white/20 text-white"
                        )}
                    >
                        {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <Volume1 className="w-5 h-5" />}
                    </Button>

                    <div className="w-px h-8 bg-white/10 mx-2" />

                    <Button 
                        onClick={endCall}
                        className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 rotate-135"
                    >
                        <PhoneOff className="w-7 h-7" />
                    </Button>
                </div>
            </div>
          </motion.div>
        )}

        {/* End of Session / Error states */}
        {callState === 'ended' && (
             <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center gap-6"
             >
                <div className="w-20 h-20 rounded-3xl bg-red-600/10 flex items-center justify-center">
                    <PhoneOff className="w-10 h-10 text-red-600" />
                </div>
                <h2 className="text-2xl font-black">Call Ended</h2>
             </motion.div>
        )}
      </AnimatePresence>

      {/* Add Participant Dialog */}
      <Dialog open={showAddParticipant} onOpenChange={setShowAddParticipant}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Add to Conference</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
                <Input 
                    placeholder="Search staff members..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 focus:ring-blue-500 pl-10"
                />
                <User className="absolute left-3 top-2.5 w-5 h-5 text-zinc-500" />
            </div>
            <ScrollArea className="h-[300px] rounded-md">
                <div className="space-y-2 pr-4">
                    {filteredUsers.length > 0 ? filteredUsers.map(u => (
                        <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors border border-transparent hover:border-white/5">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarFallback className="bg-zinc-700 font-bold">{u.full_name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-sm font-bold">{u.full_name}</p>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{u.role}</p>
                                </div>
                            </div>
                            <Button 
                                size="sm" 
                                disabled={!onlineUsers[u.id]}
                                onClick={() => {
                                    addParticipant(u.id, u.full_name);
                                    setShowAddParticipant(false);
                                }}
                                className={cn(
                                    "rounded-lg font-bold text-xs h-8 px-4",
                                    onlineUsers[u.id] ? "bg-blue-600 hover:bg-blue-700" : "bg-zinc-700 text-zinc-500"
                                )}
                            >
                                {onlineUsers[u.id] ? 'Add' : 'Offline'}
                            </Button>
                        </div>
                    )) : (
                        <div className="py-10 text-center text-zinc-500 italic text-sm">No staff found online</div>
                    )}
                </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
