"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuditLog } from "@/lib/api";

const VERDICT_STYLES: Record<string, string> = {
  allow: "bg-[#00D17A]/15 text-[#006B3E] hover:bg-[#00D17A]/15 border border-[#00D17A]/30",
  warn: "bg-[#F2B441]/15 text-[#8A6200] hover:bg-[#F2B441]/15 border border-[#F2B441]/30",
  block: "bg-[#E5484D]/15 text-[#9B1C1F] hover:bg-[#E5484D]/15 border border-[#E5484D]/30",
};

const PAGE_SIZE = 50;

interface LogsTableProps {
  logs: AuditLog[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  onFilterChange: (filters: { verdict: string }) => void;
}

export function LogsTable({
  logs,
  total,
  page,
  onPageChange,
  onFilterChange,
}: LogsTableProps) {
  const [verdict, setVerdict] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleVerdictChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setVerdict(e.target.value);
    onFilterChange({ verdict: e.target.value });
    onPageChange(1);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <select
          value={verdict}
          onChange={handleVerdictChange}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All verdicts</option>
          <option value="allow">Allow</option>
          <option value="warn">Warn</option>
          <option value="block">Block</option>
        </select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Timestamp</TableHead>
              <TableHead>Tool</TableHead>
              <TableHead>Command</TableHead>
              <TableHead className="w-24">Verdict</TableHead>
              <TableHead className="w-24 text-right">Risk Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No audit logs found.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">{log.tool_name}</TableCell>
                  <TableCell className="text-sm font-mono max-w-xs">
                    {log.command ? (
                      <span title={log.command}>
                        {log.command.length > 60
                          ? log.command.slice(0, 60) + "…"
                          : log.command}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={VERDICT_STYLES[log.verdict] ?? ""}>
                      {log.verdict.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {log.risk_score.toFixed(1)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} total — page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
