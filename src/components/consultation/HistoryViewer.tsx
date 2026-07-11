import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, History } from 'lucide-react';

interface HistoryViewerProps {
  history: any[];
  onViewRx: (visit: any) => void;
}

export default function HistoryViewer({ history, onViewRx }: HistoryViewerProps) {
  if (history.length === 0) return null;

  return (
    <Card className="border-none shadow-sm bg-card">
      <CardHeader className="pb-3 px-6">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          Visit History
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="space-y-3 max-h-56 overflow-auto">
          {history.map(h => (
            <div key={h.id} className="text-sm p-3 rounded-xl bg-muted border border-border flex items-center justify-between group hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                   <span className="font-bold text-foreground">{new Date(h.created_at).toLocaleDateString()}</span>
                   <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                     Token #{h.token_number}
                   </span>
                </div>
                {h.diagnosis && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate italic">
                    Dx: {h.diagnosis}
                  </p>
                )}
              </div>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 transition-colors shrink-0"
                onClick={() => onViewRx(h)}
              >
                <Eye className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
