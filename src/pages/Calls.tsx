import { useState } from 'react';
import { useCommunication } from '@/lib/communication';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, User, Search, RefreshCw, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import PageBanner from '@/components/PageBanner';
import userMgmtBanner from '@/assets/user_mgmt_banner.png';
import Lottie from "lottie-react";
import communicationAnimation from "@/assets/animations/analytics.json"; // Reusing an animation for now or replace later

export default function Calls() {
  const { user } = useAuth();
  const { allUsers, onlineUsers, makeCall, callState, refreshUsers } = useCommunication();
  const [search, setSearch] = useState('');

  // Filter out the current user and apply search
  const displayedUsers = allUsers
    .filter(u => u.id !== user?.id)
    .filter(u => u.full_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
        // Sort online users to the top
        const aOnline = !!onlineUsers[a.id];
        const bOnline = !!onlineUsers[b.id];
        if (aOnline && !bOnline) return -1;
        if (!aOnline && bOnline) return 1;
        // Alphabetical secondary sort
        return a.full_name.localeCompare(b.full_name);
    });

  return (
    <div className="max-w-[1200px] mx-auto animate-in fade-in duration-500 pb-12">
      <PageBanner
        title="Consult Staff"
        description="Connect instantly with doctors and clinic staff for real-time consultation."
        imageSrc={userMgmtBanner}
      >
        <div className="w-24 h-24 md:w-32 md:h-32 -ml-4">
          <Lottie animationData={communicationAnimation} loop={true} />
        </div>
      </PageBanner>

      <div className="px-4 md:px-8 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-4 bg-card p-4 rounded-2xl border border-border">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search staff or doctors..." 
                  className="pl-10 h-11 bg-muted/50 border-none rounded-xl"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                className="shrink-0 rounded-xl"
                onClick={() => refreshUsers()}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {displayedUsers.length > 0 ? (
                displayedUsers.map((u) => {
                  const isOnline = !!onlineUsers[u.id];
                  return (
                    <Card key={u.id} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden bg-card/60 backdrop-blur-sm">
                      <CardContent className="p-0">
                        <div className="p-4 md:p-5 flex items-center gap-3 md:gap-4">
                          <div className="relative">
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl ring-1 ring-primary/20">
                              {u.full_name.charAt(0)}
                            </div>
                            <div className={cn(
                                "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card shadow-sm",
                                isOnline ? "bg-emerald-500 shadow-emerald-500/50" : "bg-amber-400 shadow-amber-400/50"
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-foreground truncate text-sm md:text-base">{u.full_name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-[9px] uppercase font-bold px-1.5 py-0 h-4 bg-muted text-muted-foreground border-none">
                                {u.role}
                              </Badge>
                              {isOnline ? (
                                <span className="text-[10px] text-emerald-500 font-extrabold uppercase tracking-widest flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-500 font-extrabold uppercase tracking-widest opacity-80">Offline</span>
                              )}
                            </div>
                          </div>
                          <Button 
                            onClick={() => makeCall(u.id, u.full_name)}
                            disabled={callState !== 'idle' || !isOnline}
                            size="icon" 
                            className={cn(
                                "w-12 h-12 rounded-xl shadow-lg transition-all active:scale-90 shrink-0",
                                isOnline 
                                  ? "bg-primary hover:bg-primary/90 text-white shadow-primary/30" 
                                  : "bg-muted text-muted-foreground shadow-none opacity-40 grayscale"
                            )}
                          >
                            <Phone className="w-5 h-5" />
                          </Button>
                        </div>
                        <div className="px-5 py-2.5 bg-muted/20 border-t border-border/40 flex items-center justify-between">
                           <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">Extension</span>
                           <span className="text-[10px] font-mono font-bold text-foreground/40 tracking-wider">#{u.id.slice(-5).toUpperCase()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="col-span-full py-20 text-center space-y-4">
                   <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto opacity-50">
                     <User className="w-8 h-8 text-muted-foreground" />
                   </div>
                   <div className="space-y-1">
                     <p className="font-bold text-muted-foreground">No online staff found</p>
                     <p className="text-xs text-muted-foreground/60">Others will appear here once they log in.</p>
                   </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Info */}
          <div className="space-y-6">
            <Card className="border-none shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Consultation Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground/80">Immediate Response</p>
                  <p className="text-xs text-muted-foreground">Calls are peer-to-peer and secure. Use them for quick patient status updates or lab results.</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground/80">Microphone Required</p>
                  <p className="text-xs text-muted-foreground">Ensure your browser has permission to access the microphone for smooth communication.</p>
                </div>
                <div className="p-3 bg-card border border-primary/10 rounded-xl">
                   <p className="text-[10px] font-bold text-primary uppercase">Pro Tip</p>
                   <p className="text-[10px] text-muted-foreground mt-1">You can call stay on this page while consulting or navigate as the call will stay active.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm overflow-hidden">
               <div className="p-4 bg-emerald-500/10 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Privacy Secured</span>
               </div>
               <CardContent className="p-4">
                  <p className="text-[11px] text-muted-foreground">All internal consultations are end-to-end encrypted within the clinic network.</p>
               </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
