import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './auth';
import type { Peer, MediaConnection } from 'peerjs';

// We'll import Peer dynamically to avoid SSR issues if any, 
// though this is a SPA.
let PeerClass: any;

interface CommunicationContextType {
  allUsers: Array<{ id: string, full_name: string, role: string }>;
  onlineUsers: Record<string, { full_name: string, role: string, last_seen: string }>;
  callState: 'idle' | 'dialing' | 'ringing' | 'connected' | 'ended';
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
  const [callState, setCallState] = useState<'idle' | 'dialing' | 'ringing' | 'connected' | 'ended'>('idle');
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

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

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
     try {
         // Matching UserManagement.tsx logic for perfect synchronization
         const [{ data: profilesData, error: profError }, { data: rolesData, error: rolesError }] = await Promise.all([
            supabase.from('profiles').select('*'),
            supabase.from('user_roles').select('*')
         ]);
         
         if (profError) throw profError;
         if (rolesError) throw rolesError;
         
         if (profilesData) {
             const merged = profilesData.map((p: any) => {
                 const r = rolesData?.find(role => role.user_id === p.user_id);
                 
                 const displayName = (p?.full_name && p.full_name !== 'Staff Member') 
                    ? p.full_name 
                    : (p?.email || 'Staff Member');

                 return {
                     id: p.user_id,
                     full_name: displayName,
                     role: r?.role || 'staff'
                 };
             });
             setAllUsers(merged);
         }
     } catch (err) {
         console.error('[Comm] Failed to fetch clinic directory:', err);
     }
  };

  useEffect(() => {
    if (user) fetchUsers();
  }, [user?.id]);

  // Use stable dependencies for effects to prevent "churn" 
  const userId = user?.id;
  const profileName = profile?.full_name;
  const rolesString = roles.join(',');

  // --- PeerJS Effect ---
  useEffect(() => {
    if (!userId || !PeerClass) return;

    console.log('[Peer] Initializing for user:', userId);
    
    // Initialize PeerJS with User ID
    const newPeer = new PeerClass(`prescripto-${userId}`, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]
      }
    });

    newPeer.on('open', (id: string) => {
      console.log('[Peer] Connected with ID:', id);
      setPeer(newPeer);
      peerRef.current = newPeer;
    });

    newPeer.on('call', async (call: any) => {
      console.log('[Peer] Incoming stream call from:', call.peer);
      currentCallRef.current = call;
      
      // AUTO-ANSWER: If the user already clicked "Accept" in the UI, we should answer the media call immediately
      if (waitingToAnswerRef.current) {
         console.log('[Peer] Auto-answering call as user already accepted UI');
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
         } catch (err) {
            console.error('[Peer] Failed to auto-answer:', err);
            cleanupCall();
         }
      }
    });

    newPeer.on('error', (err: any) => {
      console.error('[Peer] Error:', err);
    });

    return () => {
      console.log('[Peer] Destroying connection for user:', userId);
      newPeer.destroy();
      setPeer(null);
      peerRef.current = null;
    };
  }, [userId, PeerClass]);

  // --- Supabase Realtime (Presence & Signaling) Effect ---
  useEffect(() => {
    if (!userId) return;

    console.log('[Comm] Connecting signaling for user:', userId);

    // Supabase Presence
    const presenceChannel = supabase.channel('online-staff', {
      config: { presence: { key: userId } }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        console.log('[Comm] Presence Sync:', Object.keys(state));
        const formatted: Record<string, any> = {};
        Object.keys(state).forEach(key => {
          const presence = state[key][0] as any;
          formatted[key] = presence;
        });
        setOnlineUsers(formatted);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Comm] Presence Subscribed. Tracking user...');
          await presenceChannel.track({
            id: userId,
            full_name: profileName || 'Staff Member',
            role: rolesString.split(',')[0] || 'staff',
            last_seen: new Date().toISOString()
          });
        }
      });

    presenceChannelRef.current = presenceChannel;

    // Signaling Channel for Call Invites
    const signaling = supabase.channel(`signal-${userId}`);
    signaling
      .on('broadcast', { event: 'call-invite' }, ({ payload }) => {
        console.log('[Signal] Call invite received from:', payload.fromName);
        if (callState === 'idle') {
          setIncomingCall({ 
            from: payload.fromId, 
            fromName: payload.fromName, 
            peerId: payload.peerId,
            mode: payload.mode || 'audio'
          });
          setCallMode(payload.mode || 'audio');
          setCallState('ringing');
          ringtoneRef.current?.play().catch(e => console.warn('Autoplay blocked:', e));
        }
      })
      .on('broadcast', { event: 'call-decline' }, () => {
        console.log('[Signal] Call declined');
        setCallState('ended');
        setTimeout(() => setCallState('idle'), 2000);
      })
      .on('broadcast', { event: 'call-end' }, () => {
        console.log('[Signal] Call ended by partner');
        cleanupCall();
      })
      .subscribe((status) => {
         if (status === 'SUBSCRIBED') {
             console.log('[Signal] Channel Subscribed for user:', userId);
         }
      });

    signalingChannelRef.current = signaling;

    return () => {
      console.log('[Comm] Disconnecting signaling for user:', userId);
      presenceChannel.unsubscribe();
      signaling.unsubscribe();
    };
  }, [userId, profileName, rolesString]);

  const cleanupCall = () => {
    currentCallRef.current?.close();
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    ringtoneRef.current?.pause();
    if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
    setCallState('ended');
    setActiveCall(null);
    setIncomingCall(null);
    setTimeout(() => setCallState('idle'), 1000);
  };

  const makeCall = async (targetUserId: string, targetName: string, mode: 'audio' | 'video' = 'audio') => {
    if (!peerRef.current || !user || !profile) return;

    setCallMode(mode);
    setCallState('dialing');
    setActiveCall({ partnerId: targetUserId, partnerName: targetName, stream: null, localStream: null });

    // Send Invite via Supabase Broadcast to the target's signaling channel
    await supabase.channel(`signal-${targetUserId}`).send({
      type: 'broadcast',
      event: 'call-invite',
      payload: {
        fromId: user.id,
        fromName: profile.full_name,
        peerId: peerRef.current.id,
        mode: mode
      }
    });
  };

  const acceptCall = async () => {
    if (!incomingCallRef.current || !currentCallRef.current) return;

    ringtoneRef.current?.pause();
    if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
    
    // Send accept signal to the dialer
    await supabase.channel(`signal-${incomingCallRef.current.from}`).send({
        type: 'broadcast',
        event: 'call-accept',
        payload: { 
            peerId: peerRef.current?.id,
            partnerName: profile?.full_name || 'Staff',
            mode: incomingCallRef.current.mode
        }
    });

    waitingToAnswerRef.current = true;
    setCallState('ringing'); // Maintain UI state until PeerJS stream arrives via 'on call'
  };

  const declineCall = async () => {
    if (!incomingCall) return;
    ringtoneRef.current?.pause();
    
    await supabase.channel(`signal-${incomingCall.from}`).send({
      type: 'broadcast',
      event: 'call-decline',
      payload: { fromId: user?.id }
    });
    
    cleanupCall();
  };

  const endCall = async () => {
    if (!activeCall) return;
    
    await supabase.channel(`signal-${activeCall.partnerId}`).send({
      type: 'broadcast',
      event: 'call-end',
      payload: { fromId: user?.id }
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
      refreshUsers: fetchUsers
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
