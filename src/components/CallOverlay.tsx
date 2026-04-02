import { useCommunication } from '@/lib/communication';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

export default function CallOverlay() {
  const { callState, incomingCall, activeCall, acceptCall, declineCall, endCall } = useCommunication();
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (activeCall?.stream && remoteAudioRef.current) {
        console.log('[CallOverlay] Attaching remote stream to audio element');
        remoteAudioRef.current.srcObject = activeCall.stream;
        remoteAudioRef.current.play().catch(e => console.error('Play failed:', e));
    }
  }, [activeCall?.stream]);

  if (callState === 'idle') return null;

  return (
    <div className="fixed inset-x-0 top-6 z-[100] flex justify-center pointer-events-none px-4">
      <div className="pointer-events-auto bg-card border border-border shadow-2xl rounded-2xl p-6 min-w-[320px] max-w-md animate-in slide-in-from-top-4 duration-300">
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
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border-2 border-emerald-500">
                <User className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-bold">Consultation Active</h3>
                <p className="text-xs text-emerald-500 font-bold flex items-center gap-1.5 uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Call with {activeCall?.partnerName}
                </p>
              </div>
            </div>

            <Button 
              onClick={endCall} 
              variant="destructive" 
              className="w-full rounded-xl h-12 gap-2"
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
