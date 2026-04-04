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
  activeParticipants: Array<{ id: string, name: string, stream: MediaStream | null, isLocal?: boolean }>;
  isMuted: boolean;
  isVideoOff: boolean;
  isOnHold: boolean;
  isPartnerOnHold: boolean;
  makeCall: (targetUserId: string, targetName: string, mode?: 'audio' | 'video') => Promise<void>;
  addParticipant: (targetUserId: string, targetName: string) => Promise<void>;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleHold: () => void;
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
  const [activeParticipants, setActiveParticipants] = useState<Array<{ id: string, name: string, stream: MediaStream | null, isLocal?: boolean }>>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isPartnerOnHold, setIsPartnerOnHold] = useState(false);
  
  const peerRef = useRef<Peer | null>(null);
  const callsRef = useRef<Map<string, MediaConnection>>(new Map());
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
          const partnerUserId = call.peer.split('-')[1]; // prescripto-userId-sessionId
          callsRef.current.set(partnerUserId, call);
          
          if (waitingToAnswerRef.current || callStateRef.current === 'connected') {
             try {
                let stream = localStreamRef.current;
                if (!stream) {
                    const constraints = {
                        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                        video: (incomingCallRef.current?.mode === 'video' || callMode === 'video') ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false
                    };
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                    localStreamRef.current = stream;
                }
                
                call.answer(stream);
                setCallState('connected');
                waitingToAnswerRef.current = false;
                
                call.on('stream', (remoteStream: MediaStream) => {
                    const partnerName = allUsers.find(u => u.id === partnerUserId)?.full_name || 'Staff';
                    
                    setActiveParticipants(prev => {
                        const exists = prev.find(p => p.id === partnerUserId);
                        if (exists) return prev.map(p => p.id === partnerUserId ? { ...p, stream: remoteStream } : p);
                        return [...prev, { id: partnerUserId, name: partnerName, stream: remoteStream }];
                    });

                    setActiveCall(prev => {
                        if (!prev || prev.partnerId === partnerUserId) {
                            return { partnerId: partnerUserId, partnerName, stream: remoteStream, localStream: stream };
                        }
                        return prev;
                    });
                });

                call.on('close', () => {
                   handleParticipantLeave(partnerUserId);
                });
                
                call.on('error', (e: any) => {
                    console.error('[Peer] Call error for:', partnerUserId, e);
                    handleParticipantLeave(partnerUserId);
                });
             } catch (err) {
                toast.error('Media access failed.');
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
        
        if ((callStateRef.current === 'dialing' || callStateRef.current === 'connected') && peerRef.current) {
          try {
            let stream = localStreamRef.current;
            if (!stream) {
                stream = await getMediaStream(payload.mode || 'video');
                localStreamRef.current = stream;
            }
            
            const call = peerRef.current.call(payload.peerId, stream);
            callsRef.current.set(payload.fromUserId || payload.peerId.split('-')[1], call);
            
            if (callStateRef.current === 'dialing') setCallState('connecting');
            
            call.on('stream', (remoteStream) => {
              toast.dismiss('call-connecting');
              setCallState('connected');
              
              const partnerId = payload.fromUserId || payload.peerId.split('-')[1];
              const partnerName = payload.partnerName || 'Staff';

              setActiveParticipants(prev => {
                  const exists = prev.find(p => p.id === partnerId);
                  if (exists) return prev.map(p => p.id === partnerId ? { ...p, stream: remoteStream } : p);
                  return [...prev, { id: partnerId, name: partnerName, stream: remoteStream }];
              });

              setActiveCall(prev => {
                  if (!prev || prev.partnerId === partnerId) {
                      return { partnerId: partnerId, partnerName, stream: remoteStream, localStream: stream };
                  }
                  return prev;
              });
            });
            call.on('error', (e) => console.error('[Peer] Call Stream Error:', e));
            call.on('close', () => handleParticipantLeave(payload.fromUserId || payload.peerId.split('-')[1]));
          } catch (err) {
            toast.error('Could not start media.');
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
      .on('broadcast', { event: 'call-hold' }, ({ payload }) => {
        if (payload.toUserId !== userId) return;
        setIsPartnerOnHold(true);
      })
      .on('broadcast', { event: 'call-resume' }, ({ payload }) => {
        if (payload.toUserId !== userId) return;
        setIsPartnerOnHold(false);
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

  const handleParticipantLeave = (pId: string) => {
    callsRef.current.delete(pId);
    setActiveParticipants(prev => prev.filter(p => p.id !== pId));
    if (activeCall?.partnerId === pId) {
        // If the main partner left, end the whole thing for now, or pick next
        if (activeParticipants.length <= 2) { // Just local and leaving partner
            cleanupCall();
        } else {
            setActiveParticipants(prev => {
                const remaining = prev.filter(p => p.id !== pId && !p.isLocal);
                if (remaining.length > 0) {
                    setActiveCall({
                        partnerId: remaining[0].id,
                        partnerName: remaining[0].name,
                        stream: remaining[0].stream,
                        localStream: localStreamRef.current
                    });
                }
                return prev.filter(p => p.id !== pId);
            });
        }
    }
  };

  const cleanupCall = () => {
    callsRef.current.forEach(call => call.close());
    callsRef.current.clear();
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    ringtoneRef.current?.pause();
    if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
    setCallState('ended');
    setActiveCall(null);
    setActiveParticipants([]);
    setIncomingCall(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsOnHold(false);
    setIsPartnerOnHold(false);
    waitingToAnswerRef.current = false;
    setTimeout(() => setCallState('idle'), 1000);
  };

  const makeCall = async (targetUserId: string, targetName: string, mode: 'audio' | 'video' = 'audio') => {
    if (!peerRef.current || !user || !profile || !signalingChannelRef.current) return;

    setCallMode(mode);
    setCallState('dialing');
    
    const localStream = await getMediaStream(mode);
    localStreamRef.current = localStream;
    
    setActiveCall({ partnerId: targetUserId, partnerName: targetName, stream: null, localStream });
    setActiveParticipants([
        { id: user.id, name: profile.full_name, stream: localStream, isLocal: true }
    ]);

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

  const addParticipant = async (targetUserId: string, targetName: string) => {
    if (!peerRef.current || !user || !profile || !signalingChannelRef.current || !localStreamRef.current) return;

    toast.info(`Inviting ${targetName} to conference...`);

    // Send Invite to the new person
    await signalingChannelRef.current.send({
      type: 'broadcast',
      event: 'call-invite',
      payload: {
        toUserId: targetUserId,
        fromUserId: user.id,
        fromName: profile.full_name,
        peerId: peerRef.current.id,
        mode: callMode,
        isConference: true
      }
    });

    // Also tell existing participants that a new person is joining?
    // In Mesh, everyone needs to call everyone. But for now, we'll simplify: 
    // The "host" (person who adds) acts as the bridge if needed, but PeerJS Mesh is better.
    // To keep it simple: the new person will receive invites from the host.
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
    
    setActiveParticipants([
        { id: userId!, name: profile?.full_name || 'Me', stream: null, isLocal: true },
        { id: incomingCallRef.current.from, name: incomingCallRef.current.fromName, stream: null }
    ]);

    // Send accept signal to the dialer via Global Signaling (Triple-Send for reliability)
    const payload = { 
        toUserId: incomingCallRef.current.from,
        fromUserId: userId,
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

    setCallState('connecting'); 

    // HANDSHAKE TIMEOUT supervisor
    setTimeout(() => {
        if (callStateRef.current === 'connecting' && !activeCall?.stream) {
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
    cleanupCall();
    
    if (activeParticipants.length > 0) {
        activeParticipants.forEach(async (p) => {
            if (p.isLocal) return;
            await signalingChannelRef.current.send({
                type: 'broadcast',
                event: 'call-end',
                payload: { toUserId: p.id, fromUserId: user?.id }
            });
        });
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
        const audioTracks = localStreamRef.current.getAudioTracks();
        audioTracks.forEach(track => track.enabled = !track.enabled);
        setIsMuted(!audioTracks[0].enabled);
    }
  };

  const toggleVideo = async () => {
    if (localStreamRef.current) {
        const videoTracks = localStreamRef.current.getVideoTracks();
        if (videoTracks.length === 0) {
            try {
                const vidStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const newTrack = vidStream.getVideoTracks()[0];
                localStreamRef.current.addTrack(newTrack);
                setIsVideoOff(false);
                setCallMode('video');
                // Note: PeerJS doesn't automatically send newly added tracks.
                // In a production app, we would re-negotiate or use a different library.
                // For now, we update the local UI and the partner will see a blank container
                // until re-connection or if we decide to re-call.
            } catch (err) {
                toast.error('Could not access camera');
            }
        } else {
            videoTracks.forEach(track => track.enabled = !track.enabled);
            setIsVideoOff(!videoTracks[0].enabled);
        }
    }
  };

  const toggleHold = () => {
    const newState = !isOnHold;
    setIsOnHold(newState);
    
    // Notify Partner
    if (activeParticipants.length > 0) {
        activeParticipants.forEach(async (p) => {
            if (p.isLocal) return;
            await signalingChannelRef.current.send({
                type: 'broadcast',
                event: newState ? 'call-hold' : 'call-resume',
                payload: { toUserId: p.id, fromUserId: user?.id }
            });
        });
    }

    if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.enabled = !newState);
    }
  };

  return (
    <CommunicationContext.Provider value={{ 
      allUsers,
      onlineUsers, 
      callState, 
      callMode,
      incomingCall, 
      activeCall, 
      activeParticipants,
      isMuted,
      isVideoOff,
      isOnHold,
      isPartnerOnHold,
      makeCall, 
      addParticipant,
      acceptCall, 
      declineCall, 
      endCall,
      toggleMute,
      toggleVideo,
      toggleHold,
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
