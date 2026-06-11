import { useQuery } from '@tanstack/react-query';
import { ScrollText, TriangleAlert } from 'lucide-react';
import { listCertAlerts, listCertificates, type Certificate } from '../api';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Stat } from '@/components/ui/stat';
import { EmptyState } from '@/components/ui/empty-state';
import { certStatusBadge, shortDate } from '../lib/format';

/**
 * Compliance certificates — the statutory register with escalating expiry alerts (fire
 * alarm, emergency lighting, electrical, lift, legionella, F-gas, asbestos, BCAR CCC).
 * Reference screen for the "Lumen" design system. Engine: domain/compliance.ts.
 */
export function Certificates() {
  const certs = useQuery({ queryKey: ['certificates'], queryFn: listCertificates });
  const alerts = useQuery({ queryKey: ['cert-alerts'], queryFn: listCertAlerts });
  const certificates = certs.data?.certificates ?? [];
  const alertList = alerts.data?.alerts ?? [];

  const valid = certificates.filter((c) => c.status === 'valid').length;
  const expired = certificates.filter((c) => c.status === 'expired').length;

  return (
    <>
      <PageHeader
        title="Compliance certificates"
        subtitle="Statutory certificate register with escalating expiry alerts — the audit-ready golden thread for inspections."
      />

      {certs.isError && (
        <Card className="mb-5">
          <EmptyState tone="error" icon={<TriangleAlert />} title="Couldn’t load certificates" description="Start the stack with “npm run dev”." />
        </Card>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Certificates" value={certificates.length} />
        <Stat label="Valid" value={valid} tone="ok" />
        <Stat label="Expiring soon" value={alertList.length} tone={alertList.length ? 'watch' : 'default'} />
        <Stat label="Expired" value={expired} tone={expired ? 'crit' : 'default'} />
      </div>

      {alertList.length > 0 && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Expiring soon</CardTitle>
            <CardDescription>{alertList.length} alert(s)</CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Type</TableHead><TableHead>Ref</TableHead><TableHead>Expiry</TableHead><TableHead>Days left</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {alertList.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.cert_type_code}</TableCell>
                  <TableCell className="text-muted-foreground">{a.ref ?? '—'}</TableCell>
                  <TableCell className="tabular-nums">{shortDate(a.expiry_date)}</TableCell>
                  <TableCell><Badge tone={a.days_until <= 14 ? 'crit' : 'watch'}>{a.days_until} days</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Certificate register</CardTitle>
          <CardDescription>{certificates.length} shown</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Type</TableHead><TableHead>Ref</TableHead><TableHead>Issuer</TableHead><TableHead>Issued</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {certificates.map((c: Certificate) => {
              const b = certStatusBadge(c.status);
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-semibold">{c.cert_type_code}</TableCell>
                  <TableCell className="text-muted-foreground">{c.ref ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.issuer ?? '—'}</TableCell>
                  <TableCell className="tabular-nums">{shortDate(c.issue_date)}</TableCell>
                  <TableCell className="tabular-nums">{shortDate(c.expiry_date)}</TableCell>
                  <TableCell><Badge tone={b.tone}>{b.label}</Badge></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {!certificates.length && (
          <EmptyState icon={<ScrollText />} title="No certificates" description="Statutory certificates will appear here once recorded." />
        )}
      </Card>
    </>
  );
}
