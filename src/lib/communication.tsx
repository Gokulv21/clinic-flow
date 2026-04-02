import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './auth';
import type { Peer, MediaConnection } from 'peerjs';
import { toast } from 'sonner';

// We'll import Peer dynamically to avoid SSR issues if any, 
// though this is a SPA.
let PeerClass: any;

type CallState = 'idle' | 'dialing' | 'ringing' | 'connecting' | 'connected' | 'ended';

interface CommunicationContextType {
  allUsers: Array<{ id: string, full_name: string, role: string }>;
  peerReady: boolean;
  onlineUsers: Record<string, { full_name: string, role: string, last_seen: string }>;
  callState: CallState;
  callMode: 'audio' | 'video';
  incomingCall: { from: string, fromName: string, peerId: string, mode: 'audio' | 'video' } | null;
  activeCall: { partnerId: string, partnerName: string, stream: MediaStream | null, localStream: MediaStream | null } | null;
  makeCall: (targetUserId: string, targetName: string, mode?: 'audio' | 'video') => Promise<void>;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  refreshUsers: () => Promise<void>;
}

const CommunicationContext = createContext<CommunicationContextType | undefined>(undefined);

export function CommunicationProvider({ children }: { children: ReactNode }) {
  const { user, profile, roles } = useAuth();
  const [peer, setPeer] = useState<Peer | null>(null);
  const [allUsers, setAllUsers] = useState<Array<{ id: string, full_name: string, role: string }>>([]);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});
  const [callState, setCallState] = useState<CallState>('idle');
  const [callMode, setCallMode] = useState<'audio' | 'video'>('audio');
  const [incomingCall, setIncomingCall] = useState<{ from: string, fromName: string, peerId: string, mode: 'audio' | 'video' } | null>(null);
  const [activeCall, setActiveCall] = useState<{ partnerId: string, partnerName: string, stream: MediaStream | null, localStream: MediaStream | null } | null>(null);
  
  const peerRef = useRef<Peer | null>(null);
  const currentCallRef = useRef<MediaConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const presenceChannelRef = useRef<any>(null);
  const signalingChannelRef = useRef<any>(null);
  const waitingToAnswerRef = useRef(false);
  const incomingCallRef = useRef<any>(null);
  const callStateRef = useRef<string>('idle');
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('peerjs').then(({ Peer }) => {
        PeerClass = Peer;
      });
    }

    // Preload ringtone
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
    audio.loop = true;
    ringtoneRef.current = audio;

    return () => {
      audio.pause();
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  const fetchUsers = async () => {
    if (!user) return;
    try {
      const [{ data: profData, error: profError }, { data: rolesData, error: rolesError }] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('user_roles').select('*')
      ]);
      
      if (profError) throw profError;
      if (rolesError) throw rolesError;
      
      if (profData) {
        setAllUsers(profData.map((p: any) => {
          const r = rolesData?.find(role => role.user_id === p.user_id);
          return {
            id: p.user_id,
            full_name: p.full_name || p.email || 'Staff Member',
            role: r?.role || 'staff'
          };
        }));
      }
    } catch (err) {
      console.error('[Comm] Error fetching staff directory:', err);
    }
  };

  // --- User Profiles Fetching ---
  useEffect(() => {
    fetchUsers();
  }, [user?.id]);

  const userId = user?.id;
  const profileName = profile?.full_name;
  const rolesString = roles.join(',');

  const profileRef = useRef(profileName);
  const rolesRef = useRef(rolesString);
  useEffect(() => { profileRef.current = profileName; }, [profileName]);
  useEffect(() => { rolesRef.current = rolesString; }, [rolesString]);

  const [peerReady, setPeerReady] = useState(false);

  const getMediaStream = async (mode: 'audio' | 'video'): Promise<MediaStream> => {
    const constraints: any = [
      mode === 'video' ? {
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
      } : null,
      mode === 'video' ? {
        audio: { echoCancellation: true, noiseSuppression: true },
        video: true
      } : null,
      { audio: true, video: false }
    ].filter(Boolean);

    for (const constraint of constraints) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraint);
      } catch (err) {
        console.warn('[Media] Constraint failed, trying next...');
      }
    }
    throw new Error('No media devices available');
  };

  // --- PeerJS Effect ---
  useEffect(() => {
    if (!userId) return;

    const initPeer = async () => {
      try {
        const { Peer } = await import('peerjs');
        const newPeer = new Peer(`prescripto-${userId}-${sessionId}`, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:stun3.l.google.com:19302' },
              { urls: 'stun:stun.nextcloud.com:443' },
              { urls: 'stun:stun.voiparound.com:3478' }
            ]
          }
        });

        newPeer.on('open', (id: string) => {
          setPeer(newPeer);
          peerRef.current = newPeer;
          setPeerReady(true);
        });

        newPeer.on('disconnected', () => {
          newPeer.reconnect();
        });

        newPeer.on('call', async (call: any) => {
          currentCallRef.current = call;
          
          if (waitingToAnswerRef.current) {
             try {
                const constraints = {
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                    video: incomingCallRef.current?.mode === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false
                };
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                localStreamRef.current = stream;
                call.answer(stream);
                setCallState('connected');
                waitingToAnswerRef.current = false;
                
                call.on('stream', (remoteStream: MediaStream) => {
                    setActiveCall(prev => prev ? { ...prev, stream: remoteStream, localStream: stream } : null);
                });
                call.on('close', cleanupCall);
                call.on('error', (e: any) => {
                    toast.error('Media stream disrupted. Ending call.');
                    cleanupCall();
                });
             } catch (err) {
                toast.error('Could not access microphone/camera. Call failed.');
                cleanupCall();
             }
          }
        });

        newPeer.on('error', (err: any) => {
          console.error('[Peer] Global Error:', err.type, err);
        });

      } catch (err) {
        console.error('[Peer] Failed to load PeerJS:', err);
      }
    };

    initPeer();

    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
        setPeerReady(false);
      }
    };
  }, [userId]);

  // --- Supabase Realtime (Presence & Signaling) Effect ---
  useEffect(() => {
    if (!userId) return;

    // Use a Unified global channel until clinic isolation is supported in DB schema
    const channelName = `clinic-communication`;
    console.log('[Comm] Connecting to Unified Signaling:', channelName);

    const commChannel = supabase.channel(channelName, {
      config: { presence: { key: `${userId}-${sessionId}` } }
    });
 
    commChannel
      .on('presence', { event: 'sync' }, () => {
        const state = commChannel.presenceState();
        const formatted: Record<string, any> = {};
        Object.keys(state).forEach(key => {
          const presenceList = state[key] as any[];
          if (presenceList.length > 0) {
              const p = presenceList[0];
              if (p.id) formatted[p.id] = p;
          }
        });
        setOnlineUsers(formatted);
      })
      .on('broadcast', { event: 'call-invite' }, ({ payload }) => {
        if (payload.toUserId !== userId) return; 
        if (callStateRef.current === 'idle') {
          setIncomingCall({ 
            from: payload.fromUserId, 
            fromName: payload.fromName, 
            peerId: payload.peerId,
            mode: payload.mode || 'audio'
          });
          setCallMode(payload.mode || 'audio');
          setCallState('ringing');
          ringtoneRef.current?.play().catch(e => console.warn('Autoplay blocked:', e));
        }
      })
      .on('broadcast', { event: 'call-accept' }, async ({ payload }) => {
        if (payload.toUserId !== userId) return; 
        
        if (callStateRef.current === 'dialing' && peerRef.current) {
          try {
            const stream = await getMediaStream(payload.mode || 'video');
            localStreamRef.current = stream;
            
            const call = peerRef.current.call(payload.peerId, stream);
            currentCallRef.current = call;
            setCallState('connecting');
            
            call.on('stream', (remoteStream) => {
              toast.dismiss('call-connecting');
              setCallState('connected');
              setActiveCall(prev => prev ? { ...prev, stream: remoteStream, localStream: stream } : null);
            });
            call.on('error', (e) => console.error('[Peer] Call Stream Error:', e));
            call.on('close', cleanupCall);
          } catch (err) {
            toast.error('Could not start media. Check camera/mic permissions.');
            toast.dismiss('call-connecting');
            cleanupCall();
          }
        }
      })
      .on('broadcast', { event: 'call-decline' }, ({ payload }) => {
        if (payload.toUserId !== userId) return;
        setCallState('ended');
        setTimeout(() => setCallState('idle'), 2000);
      })
      .on('broadcast', { event: 'call-end' }, ({ payload }) => {
        if (payload.toUserId !== userId) return;
        cleanupCall();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await commChannel.track({
            id: userId,
            sessionId: sessionId,
            full_name: profileRef.current || 'Staff Member',
            role: rolesRef.current?.split(',')[0] || 'staff',
            last_seen: new Date().toISOString()
          });
        }
      });
 
    signalingChannelRef.current = commChannel;
    presenceChannelRef.current = commChannel;

    const heartbeat = setInterval(() => {
      if (commChannel.state === 'joined') {
        commChannel.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: { userId, timestamp: new Date().toISOString() }
        });
      } else if (commChannel.state === 'closed' || commChannel.state === 'errored') {
        commChannel.subscribe();
      }
    }, 45000);

    return () => {
      console.log('[Comm] Disconnecting comm channel for user:', userId);
      clearInterval(heartbeat);
      commChannel.unsubscribe();
    };
  }, [userId]);

  const cleanupCall = () => {
    currentCallRef.current?.close();
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    ringtoneRef.current?.pause();
    if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
    setCallState('ended');
    setActiveCall(null);
    setIncomingCall(null);
    waitingToAnswerRef.current = false;
    setTimeout(() => setCallState('idle'), 1000);
  };

  const makeCall = async (targetUserId: string, targetName: string, mode: 'audio' | 'video' = 'audio') => {
    if (!peerRef.current || !user || !profile || !signalingChannelRef.current) return;

    setCallMode(mode);
    setCallState('dialing');
    setActiveCall({ partnerId: targetUserId, partnerName: targetName, stream: null, localStream: null });

    // Send Invite via Global Signal Channel
    await signalingChannelRef.current.send({
      type: 'broadcast',
      event: 'call-invite',
      payload: {
        toUserId: targetUserId,
        fromUserId: user.id,
        fromName: profile.full_name,
        peerId: peerRef.current.id,
        mode: mode
      }
    });
  };

  const acceptCall = async () => {
    if (!incomingCallRef.current || !signalingChannelRef.current) {
        console.error('[Signal] Cannot accept: No incoming call or signaling channel');
        return;
    }

    console.log('[Signal] User clicked ACCEPT. Initiating media bridge...');
    toast.loading('Connecting secure media...', { id: 'call-connecting' });
    
    ringtoneRef.current?.pause();
    if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
    
    // Set flag so that when the PeerJS call arrives, we answer it immediately
    waitingToAnswerRef.current = true;
    
    // Initialize activeCall for the receiver so the UI can transition
    setActiveCall({
        partnerId: incomingCallRef.current.from,
        partnerName: incomingCallRef.current.fromName,
        stream: null,
        localStream: null
    });

    // Send accept signal to the dialer via Global Signaling (Triple-Send for reliability)
    const payload = { 
        toUserId: incomingCallRef.current.from,
        peerId: peerRef.current?.id, // Our specific tab's Peer ID
        partnerName: profile?.full_name || 'Staff',
        mode: incomingCallRef.current.mode
    };
    
    console.log('[Signal] Initiating Triple-Send Handshake for:', payload.toUserId);

    const sendSignal = () => signalingChannelRef.current.send({
        type: 'broadcast',
        event: 'call-accept',
        payload
    });

    sendSignal(); // Instant
    setTimeout(sendSignal, 300); // 300ms delay
    setTimeout(sendSignal, 800); // 800ms delay

    setCallState('ringing'); 

    // HANDSHAKE TIMEOUT supervisor
    setTimeout(() => {
        if (callStateRef.current === 'ringing' && waitingToAnswerRef.current) {
           console.warn('[Signal] Handshake threshold reached. Resetting...');
           toast.error('Connection timed out. Partner may have disconnected.', { id: 'call-connecting' });
           cleanupCall();
        }
    }, 15000);
  };

  const declineCall = async () => {
    if (!incomingCall || !signalingChannelRef.current) return;
    ringtoneRef.current?.pause();
    
    await signalingChannelRef.current.send({
      type: 'broadcast',
      event: 'call-decline',
      payload: { toUserId: incomingCall.from, fromUserId: user?.id }
    });
    
    cleanupCall();
  };

  const endCall = async () => {
    if (!activeCall || !signalingChannelRef.current) return;
    
    await signalingChannelRef.current.send({
      type: 'broadcast',
      event: 'call-end',
      payload: { toUserId: activeCall.partnerId, fromUserId: user?.id }
    });
    
    cleanupCall();
  };

  return (
    <CommunicationContext.Provider value={{ 
      allUsers,
      onlineUsers, 
      callState, 
      callMode,
      incomingCall, 
      activeCall, 
      makeCall, 
      acceptCall, 
      declineCall, 
      endCall,
      refreshUsers: fetchUsers,
      peerReady
    }}>
      {children}
    </CommunicationContext.Provider>
  );
}

export function useCommunication() {
  const context = useContext(CommunicationContext);
  if (context === undefined) {
    throw new Error('useCommunication must be used within a CommunicationProvider');
  }
  return context;
}
