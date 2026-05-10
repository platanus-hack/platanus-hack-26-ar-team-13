"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StatsRow } from "@/components/StatsRow";
import { LogsTable } from "@/components/LogsTable";
import { fetchLogs, fetchStats, AuditLog, CompanyStat } from "@/lib/api";

const POLL_INTERVAL = 5000;
const PAGE_SIZE = 50;

export default function Dashboard() {
  const [stats, setStats] = useState<CompanyStat[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ verdict: "" });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pageRef = useRef(page);
  const filtersRef = useRef(filters);
  pageRef.current = page;
  filtersRef.current = filters;

  const load = useCallback(async () => {
    try {
      const [statsData, logsData] = await Promise.all([
        fetchStats(),
        fetchLogs({
          verdict: filtersRef.current.verdict || undefined,
          page: pageRef.current,
          limit: PAGE_SIZE,
        }),
      ]);
      setStats(statsData);
      setLogs(logsData.data);
      setTotal(logsData.total);
      setLastUpdated(new Date());
      setError(null);
    } catch {
      setError("Could not reach backend. Is it running on port 3000?");
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    void load();
  }, [page, filters, load]);

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-[#0B0E0D]">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white font-heading">
              Hackan<span className="text-[#00D17A]">&apos;</span>t
            </h1>
            <p className="text-sm text-white/50">
              Claude Code tool usage monitoring
            </p>
          </div>
          <div className="text-xs text-white/50 text-right">
            {lastUpdated ? (
              <>
                Last updated {lastUpdated.toLocaleTimeString()}
                <br />
                <span className="text-[#00D17A]">● live (5s)</span>
              </>
            ) : (
              "Loading…"
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
            Overview
          </h2>
          <StatsRow stats={stats} />
        </section>

        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
            Audit Logs
          </h2>
          <LogsTable
            logs={logs}
            total={total}
            page={page}
            onPageChange={setPage}
            onFilterChange={setFilters}
          />
        </section>
      </div>
    </main>
  );
}
