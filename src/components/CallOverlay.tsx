import { useCommunication } from '@/lib/communication';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

export default function CallOverlay() {
  const { callState, callMode, incomingCall, activeCall, acceptCall, declineCall, endCall } = useCommunication();
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (activeCall?.stream) {
        if (callMode === 'audio' && remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = activeCall.stream;
            remoteAudioRef.current.play().catch(e => console.error('Audio play failed:', e));
        } else if (callMode === 'video' && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = activeCall.stream;
            remoteVideoRef.current.play().catch(e => console.error('Video play failed:', e));
        }
    }
  }, [activeCall?.stream, callMode]);

  useEffect(() => {
    if (activeCall?.localStream && localVideoRef.current && callMode === 'video') {
        localVideoRef.current.srcObject = activeCall.localStream;
        localVideoRef.current.play().catch(e => console.error('Local video play failed:', e));
    }
  }, [activeCall?.localStream, callMode]);

  if (callState === 'idle') return null;

  return (
    <div className="fixed inset-x-0 top-6 z-[100] flex justify-center pointer-events-none px-4">
      <div className={cn(
          "pointer-events-auto bg-card border border-border shadow-2xl rounded-2xl p-6 min-w-[320px] transition-all animate-in slide-in-from-top-4 duration-300",
          callState === 'connected' && callMode === 'video' ? "max-w-xl w-full" : "max-w-md"
      )}>
        <audio ref={remoteAudioRef} autoPlay />

        {/* Incoming Call UI */}
        {(callState === 'ringing' || incomingCall) && (
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center border-2 border-blue-500">
                <User className="w-8 h-8 text-blue-500 font-bold" />
              </div>
              <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-blue-500 animate-ping opacity-50" />
            </div>
            
            <div className="text-center">
              <h3 className="text-lg font-bold">Incoming Consultation</h3>
              <p className="text-sm text-muted-foreground font-medium">{incomingCall?.fromName || 'Someone'} is calling you</p>
            </div>

            <div className="flex items-center gap-4 w-full">
              <Button 
                onClick={declineCall} 
                variant="destructive" 
                className="flex-1 rounded-xl h-12 gap-2"
              >
                <PhoneOff className="w-4 h-4" /> Decline
              </Button>
              <Button 
                onClick={acceptCall} 
                className="flex-1 rounded-xl h-12 gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <Phone className="w-4 h-4" /> Accept
              </Button>
            </div>
          </div>
        )}

        {/* Outgoing Call UI */}
        {callState === 'dialing' && (
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-primary animate-ping opacity-50" />
            </div>
            
            <div className="text-center">
              <h3 className="text-lg font-bold italic tracking-wider">Calling Staff...</h3>
              <p className="text-sm text-muted-foreground font-medium">Connecting to {activeCall?.partnerName}</p>
            </div>

            <Button 
              onClick={endCall} 
              variant="outline" 
              className="w-full rounded-xl h-12 gap-2 border-destructive text-destructive hover:bg-destructive/10"
            >
              <X className="w-4 h-4" /> Cancel Call
            </Button>
          </div>
        )}

        {/* Active Call UI */}
        {callState === 'connected' && (
          <div className="flex flex-col items-center gap-4 relative">
             {callMode === 'video' ? (
                <div className="w-full aspect-video rounded-xl bg-black border border-border overflow-hidden relative shadow-inner">
                    <video ref={remoteVideoRef} className="w-full h-full object-cover" autoPlay playsInline />
                    
                    {/* Local Preview (PIP) */}
                    <div className="absolute bottom-2 right-2 w-24 md:w-32 aspect-video rounded-lg border-2 border-white/20 shadow-lg overflow-hidden bg-muted transition-all">
                        <video ref={localVideoRef} className="w-full h-full object-cover mirror" autoPlay playsInline muted />
                    </div>

                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/40 backdrop-blur-md rounded-md border border-white/10 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] text-white font-bold uppercase tracking-wider">{activeCall?.partnerName}</span>
                    </div>
                </div>
             ) : (
                <div className="flex items-center gap-4 w-full">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border-2 border-emerald-500">
                    <User className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-bold">Consultation Active</h3>
                    <p className="text-xs text-emerald-500 font-bold flex items-center gap-1.5 uppercase tracking-widest">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Audio with {activeCall?.partnerName}
                    </p>
                  </div>
                </div>
             )}

            <Button 
              onClick={endCall} 
              variant="destructive" 
              className={cn(
                "w-full rounded-xl h-12 gap-2 shadow-lg",
                callMode === 'video' && "mt-2"
              )}
            >
              <PhoneOff className="w-4 h-4" /> End Consultation
            </Button>
          </div>
        )}

        {/* Call Ended UI */}
        {callState === 'ended' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <PhoneOff className="w-6 h-6 text-destructive" />
            </div>
            <p className="font-bold text-destructive italic">Consultation Ended</p>
          </div>
        )}
      </div>
    </div>
  );
}
