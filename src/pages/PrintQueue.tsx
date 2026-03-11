import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Printer, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import PrescriptionTemplate from '@/components/PrescriptionTemplate';

export default function PrintQueue() {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);

  const fetchPrescriptions = async () => {
    const { data } = await supabase
      .from('prescriptions')
      .select('*, patients(name, age, sex, phone), visits(token_number, created_at)')
      .order('created_at', { ascending: false });
    setPrescriptions(data || []);
  };

  useEffect(() => {
    fetchPrescriptions();
    const channel = supabase
      .channel('prescriptions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prescriptions' }, () => fetchPrescriptions())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const [printData, setPrintData] = useState<any>(null);

  useEffect(() => {
    if (printData) {
      setTimeout(() => {
        window.print();
        markPrinted(printData.id);
        setPrintData(null);
      }, 500); // Wait for the image/component to render
    }
  }, [printData]);

  const markPrinted = async (id: string) => {
    const { error } = await supabase.from('prescriptions').update({ is_printed: true }).eq('id', id);
    if (error) toast.error('Failed to update');
    else toast.success('Marked as printed');
  };

  const printPrescription = (rx: any) => {
    setPrintData(rx);
  };

  const unprinted = prescriptions.filter(p => !p.is_printed);
  const printed = prescriptions.filter(p => p.is_printed);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Hidden print container */}
      {printData && (
        <div className="hidden print:block absolute inset-0 bg-white z-[9999] print:m-0 print:p-0">
          <PrescriptionTemplate
            patient={printData.patients}
            visit={printData.visits}
            diagnosis={printData.diagnosis}
            medicines={printData.medicines}
            handwrittenImage={printData.advice_image || null}
            isPrint={true}
          />
        </div>
      )}

      <div className="print:hidden">
        <h1 className="text-2xl font-heading font-bold">Print Queue</h1>
        <p className="text-muted-foreground">{unprinted.length} prescriptions waiting to be printed</p>
      </div>

      <Tabs defaultValue="unprinted" className="print:hidden">
        <TabsList>
          <TabsTrigger value="unprinted" className="gap-2">
            <Clock className="w-4 h-4" />Unprinted ({unprinted.length})
          </TabsTrigger>
          <TabsTrigger value="printed" className="gap-2">
            <CheckCircle className="w-4 h-4" />Printed ({printed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unprinted" className="space-y-3">
          {unprinted.map(rx => (
            <Card key={rx.id} className="animate-fade-in">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{rx.patients?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Token #{rx.visits?.token_number} · {new Date(rx.created_at).toLocaleTimeString()}
                    {rx.diagnosis ? ` · ${rx.diagnosis}` : ''}
                  </p>
                </div>
                <Button onClick={() => printPrescription(rx)} className="gap-2">
                  <Printer className="w-4 h-4" />Print
                </Button>
              </CardContent>
            </Card>
          ))}
          {unprinted.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>All prescriptions have been printed</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="printed" className="space-y-3">
          {printed.map(rx => (
            <Card key={rx.id} className="opacity-70">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{rx.patients?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Token #{rx.visits?.token_number} · {new Date(rx.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="secondary" className="gap-1"><CheckCircle className="w-3 h-3" />Printed</Badge>
                  <Button onClick={() => printPrescription(rx)} variant="outline" size="sm" className="gap-1">
                    <Printer className="w-3 h-3" /> Re-Print
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}