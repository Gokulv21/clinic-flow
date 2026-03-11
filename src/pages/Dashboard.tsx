import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { ClipboardPlus, Stethoscope, Printer, BarChart3, Users } from 'lucide-react';

export default function Dashboard() {
  const { profile, roles, hasRole } = useAuth();
  const navigate = useNavigate();

  const modules = [
    { label: 'Patient Entry', desc: 'Register patients & record vitals', icon: <ClipboardPlus className="w-8 h-8" />, path: '/nurse', roles: ['nurse', 'doctor'] as const, color: 'bg-nurse/10 text-nurse' },
    { label: 'Consultation', desc: 'View queue & write prescriptions', icon: <Stethoscope className="w-8 h-8" />, path: '/consultation', roles: ['doctor'] as const, color: 'bg-doctor/10 text-doctor' },
    { label: 'Print Queue', desc: 'Print patient prescriptions', icon: <Printer className="w-8 h-8" />, path: '/print', roles: ['printer', 'doctor'] as const, color: 'bg-printer/10 text-printer' },
    { label: 'Patients', desc: 'Search & manage patient records', icon: <Users className="w-8 h-8" />, path: '/patients', roles: ['doctor'] as const, color: 'bg-primary/10 text-primary' },
    { label: 'Analytics', desc: 'View clinic statistics', icon: <BarChart3 className="w-8 h-8" />, path: '/analytics', roles: ['doctor'] as const, color: 'bg-accent/10 text-accent' },
  ];

  const visibleModules = modules.filter(m => m.roles.some(r => hasRole(r)));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold">Welcome, {profile?.full_name}</h1>
        <p className="text-muted-foreground">
          {roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')} Dashboard
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleModules.map(m => (
          <Card
            key={m.path}
            className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1"
            onClick={() => navigate(m.path)}
          >
            <CardContent className="pt-6 space-y-3">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${m.color}`}>
                {m.icon}
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg">{m.label}</h3>
                <p className="text-sm text-muted-foreground">{m.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}