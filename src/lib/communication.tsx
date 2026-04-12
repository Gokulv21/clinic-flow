import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './auth';
import { 
  Room, 
  RoomEvent, 
  VideoPresets, 
  Track, 
  RemoteParticipant, 
  RemoteTrack, 
  RemoteTrackPublication,
  LocalVideoTrack,
  LocalAudioTrack,
  ConnectionState
} from 'livekit-client';
import { toast } from 'sonner';

type CallState = 'idle' | 'dialing' | 'ringing' | 'connecting' | 'connected' | 'ended';

interface CommunicationContextType {
  allUsers: Array<{ id: string, full_name: string, role: string }>;
  roomReady: boolean;
  onlineUsers: Record<string, { full_name: string, role: string, last_seen: string }>;
  callState: CallState;
  callMode: 'audio' | 'video';
  incomingCall: { from: string, fromName: string, roomName: string, mode: 'audio' | 'video' } | null;
  activeCall: { partnerId: string, partnerName: string, stream: MediaStream | null, localStream: MediaStream | null } | null;
  activeParticipants: Array<{ id: string, name: string, stream: MediaStream | null, isLocal?: boolean, videoOff?: boolean }>;
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
  toggleSpeaker: () => void;
  isSpeakerOn: boolean;
  refreshUsers: () => Promise<void>;
}

const CommunicationContext = createContext<CommunicationContextType | undefined>(undefined);

export function CommunicationProvider({ children }: { children: ReactNode }) {
  const { user, profile, roles } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [allUsers, setAllUsers] = useState<Array<{ id: string, full_name: string, role: string }>>([]);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});
  const [callState, setCallState] = useState<CallState>('idle');
  const [callMode, setCallMode] = useState<'audio' | 'video'>('audio');
  const [incomingCall, setIncomingCall] = useState<{ from: string, fromName: string, roomName: string, mode: 'audio' | 'video' } | null>(null);
  const [activeCall, setActiveCall] = useState<{ partnerId: string, partnerName: string, stream: MediaStream | null, localStream: MediaStream | null } | null>(null);
  const [activeParticipants, setActiveParticipants] = useState<Array<{ id: string, name: string, stream: MediaStream | null, isLocal?: boolean, videoOff?: boolean }>>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isPartnerOnHold, setIsPartnerOnHold] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const currentRoomNameRef = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const dialingToneRef = useRef<HTMLAudioElement | null>(null);
  const presenceChannelRef = useRef<any>(null);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));

  // Initialize Audio Assets
  useEffect(() => {
    const dialing = new Audio('https://assets.mixkit.co/active_storage/sfx/1547/1547-preview.mp3');
    dialing.loop = true;
    dialingToneRef.current = dialing;

    const ringing = new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3');
    ringing.loop = true;
    ringtoneRef.current = ringing;

    return () => {
      dialing.pause();
      ringing.pause();
      if (roomRef.current) roomRef.current.disconnect();
    };
  }, []);

  // Fetch Users for Directory
  const fetchUsers = async () => {
    if (!user) return;
    try {
      const [{ data: profData }, { data: rolesData }] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('user_roles').select('*')
      ]);
      
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
      console.error('[LiveKit] Error fetching staff directory:', err);
    }
  };

  useEffect(() => { fetchUsers(); }, [user?.id]);

  // --- LiveKit Room Handlers ---
  const setupRoom = (mode: 'audio' | 'video') => {
    const newRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
      publishDefaults: {
        simulcast: true, // Crucial for low bandwidth networks (India 4G)
      }
    });

    newRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        console.log('[LiveKit] Track Subscribed:', track.kind, participant.identity);
        updateParticipantsFromRoom(newRoom);
    });

    newRoom.on(RoomEvent.TrackUnsubscribed, () => updateParticipantsFromRoom(newRoom));
    newRoom.on(RoomEvent.ParticipantConnected, () => updateParticipantsFromRoom(newRoom));
    newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        handleParticipantLeave(participant.identity);
    });

    newRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
        console.log('[LiveKit] Connection State:', state);
        if (state === ConnectionState.Disconnected) {
            cleanupCall();
        } else if (state === ConnectionState.Connected) {
            setCallState('connected');
            dialingToneRef.current?.pause();
            toast.dismiss('call-connecting');
        } else if (state === ConnectionState.Reconnecting) {
            toast.loading('Reconnecting to call...', { id: 'call-reconnecting' });
        }
    });

    newRoom.on(RoomEvent.TrackMuted, () => updateParticipantsFromRoom(newRoom));
    newRoom.on(RoomEvent.TrackUnmuted, () => updateParticipantsFromRoom(newRoom));

    roomRef.current = newRoom;
    setRoom(newRoom);
    return newRoom;
  };

  const updateParticipantsFromRoom = (r: Room) => {
    const participants: any[] = [];
    
    // Add Local
    if (r.localParticipant) {
        const stream = new MediaStream();
        r.localParticipant.getTrackPublications().forEach(pub => {
            if (pub.track && pub.track.mediaStreamTrack) stream.addTrack(pub.track.mediaStreamTrack);
        });
        participants.push({
            id: r.localParticipant.identity,
            name: r.localParticipant.name || 'Me',
            stream: stream,
            isLocal: true,
            videoOff: !r.localParticipant.isCameraEnabled
        });
    }

    // Add Remotes
    r.remoteParticipants.forEach(p => {
        const stream = new MediaStream();
        p.getTrackPublications().forEach(pub => {
            if (pub.track && pub.track.mediaStreamTrack) {
                stream.addTrack(pub.track.mediaStreamTrack);
            }
        });

        participants.push({
            id: p.identity,
            name: p.name || 'Remote',
            stream: stream,
            videoOff: !p.isCameraEnabled
        });
    });

    setActiveParticipants(participants);
    if (participants.length > 1) {
        const remote = participants.find(p => !p.isLocal);
        setActiveCall({
            partnerId: remote.id,
            partnerName: remote.name,
            stream: remote.stream,
            localStream: participants.find(p => p.isLocal)?.stream || null
        });
    }
  };

  // --- Realtime Coordination (Supabase for Ringing only) ---
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel('clinic-communication', {
      config: { presence: { key: `${user.id}-${sessionId}` } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const formatted: Record<string, any> = {};
        Object.keys(state).forEach(key => {
          const p = (state[key] as any[])[0];
          if (p?.id) formatted[p.id] = p;
        });
        setOnlineUsers(formatted);
      })
      .on('broadcast', { event: 'call-invite' }, ({ payload }) => {
        if (payload.toUserId !== user.id) return;
        if (callState === 'idle') {
          setIncomingCall({ 
            from: payload.fromUserId, 
            fromName: payload.fromName, 
            roomName: payload.roomName,
            mode: payload.mode || 'audio'
          });
          setCallMode(payload.mode || 'audio');
          setCallState('ringing');
          ringtoneRef.current?.play().catch(console.warn);
        }
      })
      .on('broadcast', { event: 'call-decline' }, ({ payload }) => {
        if (payload.toUserId !== user.id) return;
        cleanupCall();
      })
      .on('broadcast', { event: 'call-end' }, ({ payload }) => {
        if (payload.toUserId !== user.id) return;
        cleanupCall();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: user.id,
            full_name: profile?.full_name || 'Staff Member',
            role: roles[0] || 'staff',
            last_seen: new Date().toISOString()
          });
        }
      });

    presenceChannelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [user?.id, callState]);

  const cleanupCall = () => {
    if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
    }
    setRoom(null);
    setCallState('ended');
    setActiveCall(null);
    setActiveParticipants([]);
    setIncomingCall(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsOnHold(false);
    setIsPartnerOnHold(false);
    ringtoneRef.current?.pause();
    dialingToneRef.current?.pause();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setTimeout(() => setCallState('idle'), 1500);
  };

  const handleParticipantLeave = (id: string) => {
    setActiveParticipants(prev => prev.filter(p => p.id !== id));
    if (activeParticipants.length <= 2) cleanupCall();
  };

  // --- Token Fetching from Edge Function ---
  const getLiveKitToken = async (roomName: string, identity: string, name: string) => {
    const { data, error } = await supabase.functions.invoke('get-livekit-token', {
      body: { roomName, identity, name }
    });
    if (error) throw error;
    return data.token;
  };

  // --- Public API ---

  const makeCall = async (targetUserId: string, targetName: string, mode: 'audio' | 'video' = 'audio') => {
    if (!user || !profile) return;
    
    setCallMode(mode);
    setCallState('dialing');
    dialingToneRef.current?.play().catch(console.warn);

    const roomName = `room-${user.id}-${targetUserId}-${Date.now()}`;
    currentRoomNameRef.current = roomName;

    // Set auto-timeout (30s)
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
        if (callState === 'dialing' || callState === 'ringing') {
            console.log('[LiveKit] Call timed out - no response');
            toast.error('No response from recipient');
            cleanupCall();
        }
    }, 30000);
    
    // Broadcast invite
    await presenceChannelRef.current.send({
      type: 'broadcast',
      event: 'call-invite',
      payload: { toUserId: targetUserId, fromUserId: user.id, fromName: profile.full_name, roomName, mode }
    });

    // Connect to SFU
    try {
        const token = await getLiveKitToken(roomName, user.id, profile.full_name);
        const r = setupRoom(mode);
        // LiveKit URL (Server hosted via Docker)
        // In local testing, use ws://localhost:7880
        // In production, use wss://livekit.yourdomain.com
        const liveKitUrl = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880';
        await r.connect(liveKitUrl, token);
        
        // Publish Tracks
        await r.localParticipant.enableCameraAndMicrophone();
        if (mode === 'audio') await r.localParticipant.setCameraEnabled(false);
        
        updateParticipantsFromRoom(r);
    } catch (err) {
        console.error('[LiveKit] Connection failed:', err);
        toast.error('Failed to establish media link');
        cleanupCall();
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !user || !profile) return;

    ringtoneRef.current?.pause();
    setCallState('connecting');
    toast.loading('Connecting secure consultation...', { id: 'call-connecting' });

    try {
        currentRoomNameRef.current = incomingCall.roomName;
        const token = await getLiveKitToken(incomingCall.roomName, user.id, profile.full_name);
        const r = setupRoom(incomingCall.mode);
        const liveKitUrl = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880';
        await r.connect(liveKitUrl, token);
        
        await r.localParticipant.enableCameraAndMicrophone();
        if (incomingCall.mode === 'audio') await r.localParticipant.setCameraEnabled(false);
        
        updateParticipantsFromRoom(r);
    } catch (err) {
        toast.error('Media connection failed');
        cleanupCall();
    }
  };

  const declineCall = async () => {
    if (!incomingCall) return;
    await presenceChannelRef.current.send({
        type: 'broadcast',
        event: 'call-decline',
        payload: { toUserId: incomingCall.from, fromUserId: user?.id }
    });
    cleanupCall();
  };

  const endCall = async () => {
    if (activeParticipants.length > 0) {
        activeParticipants.forEach(async (p) => {
            if (p.isLocal) return;
            await presenceChannelRef.current.send({
                type: 'broadcast',
                event: 'call-end',
                payload: { toUserId: p.id, fromUserId: user?.id }
            });
        });
    }
    cleanupCall();
  };

  const toggleMute = () => {
    const enabled = room?.localParticipant.isMicrophoneEnabled;
    room?.localParticipant.setMicrophoneEnabled(!enabled);
    setIsMuted(!!enabled);
  };

  const toggleVideo = () => {
    const enabled = room?.localParticipant.isCameraEnabled;
    room?.localParticipant.setCameraEnabled(!enabled);
    setIsVideoOff(!!enabled);
    if (!enabled) setCallMode('video');
  };

  const toggleHold = () => {
    const newState = !isOnHold;
    setIsOnHold(newState);
    room?.localParticipant.setMicrophoneEnabled(!newState);
    room?.localParticipant.setCameraEnabled(!newState);
  };

  const toggleSpeaker = async () => {
    try {
      const newState = !isSpeakerOn;
      setIsSpeakerOn(newState);
      
      if (room) {
        const devices = await Room.getLocalDevices('audiooutput');
        // On many browsers, we can't distinguish "earpiece" vs "speaker" 
        // without specifically tagged device labels.
        // We'll look for keywords like 'speaker', 'loudspeaker', 'audio out'.
        const speakerDevice = devices.find(d => 
          d.label.toLowerCase().includes('speaker') || 
          d.label.toLowerCase().includes('loudspeaker') ||
          d.label.toLowerCase().includes('external')
        );

        if (speakerDevice && newState) {
          await room.switchActiveDevice('audiooutput', speakerDevice.deviceId);
          toast.success('Switched to speaker');
        } else if (devices[0] && !newState) {
          await room.switchActiveDevice('audiooutput', devices[0].deviceId);
          toast.success('Switched to default output');
        }
      }
    } catch (err) {
      console.error('[LiveKit] Failed to switch audio output:', err);
      // Fallback: just toggle the state for UI
      setIsSpeakerOn(prev => !prev);
    }
  };

  return (
    <CommunicationContext.Provider value={{ 
      allUsers, onlineUsers, callState, callMode, incomingCall, activeCall, 
      activeParticipants, isMuted, isVideoOff, isOnHold, isPartnerOnHold, 
      isSpeakerOn, makeCall, 
      addParticipant: async (targetUserId: string, targetName: string) => {
        if (!user || !profile || !currentRoomNameRef.current) return;
        
        toast.info(`Inviting ${targetName} to consultation...`);
        
        await presenceChannelRef.current.send({
          type: 'broadcast',
          event: 'call-invite',
          payload: { 
            toUserId: targetUserId, 
            fromUserId: user.id, 
            fromName: profile.full_name, 
            roomName: currentRoomNameRef.current, 
            mode: callMode 
          }
        });
      },
      acceptCall, declineCall, endCall, toggleMute, toggleVideo, toggleHold, toggleSpeaker,
      refreshUsers: fetchUsers,
      roomReady: !!room
    }}>
      {children}
    </CommunicationContext.Provider>
  );
}

export function useCommunication() {
  const context = useContext(CommunicationContext);
  if (context === undefined) throw new Error('useCommunication must be used within a CommunicationProvider');
  return context;
}
