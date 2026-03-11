import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Printer, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

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

  const markPrinted = async (id: string) => {
    const { error } = await supabase.from('prescriptions').update({ is_printed: true }).eq('id', id);
    if (error) toast.error('Failed to update');
    else toast.success('Marked as printed');
  };

  const printPrescription = (rx: any) => {
    const meds = (rx.medicines as any[]) || [];
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Prescription</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: auto; }
        h1 { color: #0284c7; border-bottom: 2px solid #0284c7; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f0f9ff; }
        .vitals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0; }
        .vital-box { background: #f8fafc; padding: 8px; border-radius: 6px; text-align: center; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <h1>Prescription</h1>
      <p><strong>Patient:</strong> ${rx.patients?.name} | <strong>Age:</strong> ${rx.patients?.age}y | <strong>Sex:</strong> ${rx.patients?.sex}</p>
      <p><strong>Date:</strong> ${new Date(rx.created_at).toLocaleDateString()} | <strong>Token:</strong> #${rx.visits?.token_number}</p>
      ${rx.diagnosis ? `<p><strong>Diagnosis:</strong> ${rx.diagnosis}</p>` : ''}
      ${meds.length > 0 ? `
        <table><thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead>
        <tbody>${meds.map((m: any) => `<tr><td>${m.name}</td><td>${m.dosage}</td><td>${m.frequency}</td><td>${m.duration}</td></tr>`).join('')}</tbody></table>
      ` : ''}
      ${rx.advice_image ? `<p><strong>Advice:</strong> ${rx.advice_image}</p>` : ''}
      <script>window.print();</script>
      </body></html>
    `);
    w.document.close();
    markPrinted(rx.id);
  };

  const unprinted = prescriptions.filter(p => !p.is_printed);
  const printed = prescriptions.filter(p => p.is_printed);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Print Queue</h1>
        <p className="text-muted-foreground">{unprinted.length} prescriptions waiting to be printed</p>
      </div>

      <Tabs defaultValue="unprinted">
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
                <Badge variant="secondary" className="gap-1"><CheckCircle className="w-3 h-3" />Printed</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}