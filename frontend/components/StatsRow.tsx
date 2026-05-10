import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyStat } from "@/lib/api";

interface StatsRowProps {
  stats: CompanyStat[];
}

export function StatsRow({ stats }: StatsRowProps) {
  const totals = stats.reduce(
    (acc, s) => ({
      allow: acc.allow + s.allow,
      warn: acc.warn + s.warn,
      block: acc.block + s.block,
    }),
    { allow: 0, warn: 0, block: 0 }
  );

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Allowed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-[#00D17A]">{totals.allow}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Warned
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-[#F2B441]">{totals.warn}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Blocked
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-[#E5484D]">{totals.block}</div>
        </CardContent>
      </Card>
    </div>
  );
}
