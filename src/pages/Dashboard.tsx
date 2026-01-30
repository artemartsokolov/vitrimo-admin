import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Building2, ExternalLink, Mail, Search, Eye, LayoutDashboard, Settings, Code, RotateCcw, Menu, ChevronRight, ChevronLeft, ChevronDown, AlertCircle, Activity, ShieldAlert, Wrench, CheckCircle2, XCircle, Trash2, RefreshCw, User, Phone, X, Play, Volume2, Send, Clock, Calendar, ThumbsUp, ThumbsDown, PhoneOff, MessageCircle, Video } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ActivityTrendsChart } from '@/components/ActivityTrendsChart';
import { LandingViewsAnalytics } from '@/components/LandingViewsAnalytics';
import { ContentStudio } from '@/components/ContentStudio';

type SenderStats = {
  email: string;
  is_active: boolean;
  tz: string | null;
  daily_cap: number;
  sent_today: number;
  sent_total: number;
  remaining_today: number;
  sent_total_e1: number;
  sent_total_e2: number;
  sent_total_e3: number;
  next_available_at: string | null;
  next_slot_utc: string | null;
  next_slot_cet: string | null;
  window_open: boolean;
  cooldown_ok: boolean;
  has_active_queue: boolean;
  firsts_ready: number;
  followups_ready: number;
  can_send_now: boolean;
  pick_task_id: string | null;
  pick_task_kind: string | null;
  scheduled_at_calc: string | null;
  reasons: string[];
  opens_today: number;
  unique_opens_today: number;
  opens_total: number;
  open_rate_today_pct: number;
  unsubs_today: number;
  unique_unsubs_today: number;
  unsubs_total: number;
  unsubscribe_rate_today_pct: number;
};

type SenderAccount = {
  email: string;
  daily_cap: number;
  is_active: boolean;
  notes: string | null;
  gap_min_sec: number;
  gap_max_sec: number;
  auto_gap: boolean;  // When true, gap is auto-calculated
  tz: string | null;
  work_days: string[] | null;
  w1_start: string | null;
  w1_end: string | null;
  w2_start: string | null;
  w2_end: string | null;
  w3_start: string | null;
  w3_end: string | null;
  win_jitter_min_sec: number;
  win_jitter_max_sec: number;
  w1_days: string[] | null;
  w2_days: string[] | null;
  w3_days: string[] | null;
};

type SentEmail = {
  lead_email: string;
  lead_name: string;
  subject: string;
  body: string;
  sent_at: string;
  step: 'email1' | 'email2' | 'email3';
  opened_at: string | null;
};

const ADMIN_EMAILS = new Set(["artemvitrimo@gmail.com"]);
const DAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toggleDay = (current: number[] | null | undefined, day: number) => {
  const next = new Set(current ?? []);
  if (next.has(day)) {
    next.delete(day);
  } else {
    next.add(day);
  }
  return Array.from(next).sort((a, b) => a - b);
};

type Prompt = {
  id: string;
  name: string;
  prompt_text: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const parseTimestamp = (value?: string | null): number | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const attemptParse = (input: string) => {
    const timestamp = Date.parse(input);
    return Number.isNaN(timestamp) ? null : timestamp;
  };

  const normalizedSpacing = trimmed
    .replace(' ', 'T')
    .replace(/([+-]\d{2})(\d{2})$/, '$1:$2');

  return attemptParse(normalizedSpacing) ?? attemptParse(trimmed);
};

const StatCard = ({ label, value, helper }: { label: string; value: string | number; helper?: string }) => (
  <Card className="bg-card rounded-lg border border-border">
    <CardHeader className="pb-0.5 pt-2 px-2 md:pb-1 md:pt-3 md:px-3">
      <CardTitle className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wide">{label}</CardTitle>
    </CardHeader>
    <CardContent className="pb-2 px-2 md:pb-3 md:px-3">
      <div className="text-lg md:text-xl text-foreground font-medium">{value}</div>
      {helper && <div className="text-[9px] md:text-[10px] text-muted-foreground mt-0.5 md:mt-1">{helper}</div>}
    </CardContent>
  </Card>
);

const NavItem = ({ icon: Icon, label, active, onClick, isCollapsed }: { icon: any; label: string; active: boolean; onClick: () => void; isCollapsed?: boolean }) => (
  <button
    onClick={onClick}
    title={isCollapsed ? label : undefined}
    className={cn(
      "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-colors text-sm",
      isCollapsed && "justify-center px-2",
      active
        ? "bg-sidebar-accent text-foreground"
        : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent/50"
    )}
  >
    <Icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-foreground" : "text-sidebar-foreground")} />
    {!isCollapsed && <span>{label}</span>}
  </button>
);

const formatCountdown = (target: string | null | undefined, now: number) => {
  const targetTs = parseTimestamp(target);
  if (targetTs == null) return null;
  const diffMs = targetTs - now;
  const abs = Math.max(Math.round(diffMs / 1000), 0);
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const seconds = abs % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const WindowStatusBadge = ({
  open,
  nextTimestamp,
}: {
  open: boolean;
  nextTimestamp?: string | null;
}) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const countdown = formatCountdown(nextTimestamp ?? null, now);
  const baseClasses = open ? 'bg-emerald-500/15 text-emerald-400' : 'bg-secondary text-muted-foreground';
  const statusText = open ? 'Open' : 'Closed';
  return (
    <Badge className={cn(baseClasses, "text-[10px] px-2 py-0.5")}>
      {statusText}
      {countdown ? (open ? ` · ${countdown}` : ` · ${countdown}`) : null}
    </Badge>
  );
};

const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
  <Badge variant={ok ? 'default' : 'secondary'} className={cn(ok ? 'bg-emerald-50 text-emerald-700' : 'bg-secondary text-muted-foreground', "text-[10px] px-2 py-0.5")}>
    {label}
  </Badge>
);

// Marketing Pipeline Stats - shows leads, packages, opens by segment
const ScraperControl = () => {
  const [location, setLocation] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Settings state
  const [agentsPerSearch, setAgentsPerSearch] = useState(20);
  const [scraperEnabled, setScraperEnabled] = useState(true);
  // Quality filter settings
  const [filterLicenseActive, setFilterLicenseActive] = useState(true);
  const [filterMinSalesYear, setFilterMinSalesYear] = useState(1);
  const [filterRequireListings, setFilterRequireListings] = useState(true);
  const [filterMinAvgPrice, setFilterMinAvgPrice] = useState(500000);

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ['scraper-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scraper_settings')
        .select('key, value');
      if (error) throw error;
      return data;
    }
  });

  // Sync settings to state when loaded
  useEffect(() => {
    if (settings) {
      const getSetting = (key: string, fallback: any) => {
        const s = settings.find((st: any) => st.key === key);
        if (!s) return fallback;
        const val = s.value;
        if (typeof val === 'string') {
          if (val === 'true') return true;
          if (val === 'false') return false;
          const num = parseFloat(val);
          if (!isNaN(num)) return num;
        }
        return val;
      };

      setAgentsPerSearch(getSetting('agents_per_search', 20));
      setScraperEnabled(getSetting('scraper_enabled', true));
      setFilterLicenseActive(getSetting('filter_license_active', true));
      setFilterMinSalesYear(getSetting('filter_min_sales_year', 1));
      setFilterRequireListings(getSetting('filter_require_listings', true));
      setFilterMinAvgPrice(getSetting('filter_min_avg_price', 500000));
    }
  }, [settings]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: 'agents_per_search', value: String(agentsPerSearch), description: 'Max agents to fetch per Zillow search' },
        { key: 'scraper_enabled', value: String(scraperEnabled), description: 'Master on/off switch for scheduled scraper' },
        { key: 'filter_license_active', value: String(filterLicenseActive), description: 'Only process agents with active license' },
        { key: 'filter_min_sales_year', value: String(filterMinSalesYear), description: 'Min sales in last 12 months to process' },
        { key: 'filter_require_listings', value: String(filterRequireListings), description: 'Only process agents with active listings' },
        { key: 'filter_min_avg_price', value: String(filterMinAvgPrice), description: 'Min average sale price (3yr) to process' }
      ];
      for (const u of updates) {
        const { error } = await supabase
          .from('scraper_settings')
          .upsert({
            key: u.key,
            value: u.value,
            description: u.description,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraper-settings'] });
      toast({ title: 'Settings Saved', description: 'Scraper settings updated successfully.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const { data: history, isLoading } = useQuery({
    queryKey: ['scraper-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scraper_search_history')
        .select('*, error_message')
        .order('searched_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000 // Poll every 5s while active
  });

  // Fetch filter stats from analyzed_agents
  const { data: filterStats } = useQuery({
    queryKey: ['filter-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analyzed_agents')
        .select('processing_status');
      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach((a: any) => {
        const status = a.processing_status || 'unknown';
        counts[status] = (counts[status] || 0) + 1;
      });

      // Calculate filtered totals
      const filtered = Object.entries(counts)
        .filter(([key]) => key.startsWith('filtered_'))
        .reduce((acc, [key, val]) => {
          acc[key] = val;
          acc.total = (acc.total || 0) + val;
          return acc;
        }, {} as Record<string, number>);

      return {
        total: (data || []).length,
        filtered,
        pending: counts['pending'] || 0,
        listing_ready: counts['listing_ready'] || 0,
        completed: counts['completed'] || 0
      };
    },
    refetchInterval: 10000
  });

  const triggerMutation = useMutation({
    mutationFn: async (targetLocation: string) => {
      const { data, error } = await supabase.functions.invoke('schedule-scraper', {
        body: { location: targetLocation }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Scraper Started', description: `Launched search for ${location}` });
      setLocation('');
      queryClient.invalidateQueries({ queryKey: ['scraper-history'] });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to start', description: err.message, variant: 'destructive' });
    }
  });

  return (
    <div className="space-y-4">
      {/* Settings Card */}
      <Card className="rounded-lg border border-border">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">Scraper Settings</CardTitle>
        </CardHeader>
        <CardContent className="pb-4 space-y-4">
          {/* Scraper Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase">Agents per Search</label>
              <Input
                type="number"
                value={agentsPerSearch}
                onChange={(e) => setAgentsPerSearch(parseInt(e.target.value) || 20)}
                className="h-8 text-xs"
                min={5}
                max={100}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase">Auto-Scraper Status</label>
              <div className="flex items-center gap-2 h-8">
                <Switch
                  checked={scraperEnabled}
                  onCheckedChange={setScraperEnabled}
                  className="data-[state=checked]:bg-emerald-500"
                />
                <span className={cn("text-xs", scraperEnabled ? "text-emerald-600" : "text-muted-foreground")}>
                  {scraperEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          {/* Quality Filters */}
          <div className="pt-2 border-t border-border">
            <h4 className="text-[10px] font-medium text-muted-foreground uppercase mb-3">Quality Filters</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Active License Only</label>
                <div className="flex items-center gap-2 h-8">
                  <Switch
                    checked={filterLicenseActive}
                    onCheckedChange={setFilterLicenseActive}
                    className="data-[state=checked]:bg-blue-500"
                  />
                  <span className="text-xs text-muted-foreground">{filterLicenseActive ? 'Yes' : 'No'}</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Require Active Listings</label>
                <div className="flex items-center gap-2 h-8">
                  <Switch
                    checked={filterRequireListings}
                    onCheckedChange={setFilterRequireListings}
                    className="data-[state=checked]:bg-blue-500"
                  />
                  <span className="text-xs text-muted-foreground">{filterRequireListings ? 'Yes' : 'No'}</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Min Sales/Year</label>
                <Input
                  type="number"
                  value={filterMinSalesYear}
                  onChange={(e) => setFilterMinSalesYear(parseInt(e.target.value) || 0)}
                  className="h-8 text-xs"
                  min={0}
                  max={50}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Min Avg Sale Price ($)</label>
                <Input
                  type="number"
                  value={filterMinAvgPrice}
                  onChange={(e) => setFilterMinAvgPrice(parseInt(e.target.value) || 0)}
                  className="h-8 text-xs"
                  min={0}
                  step={100000}
                />
              </div>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => saveSettingsMutation.mutate()}
            disabled={saveSettingsMutation.isPending}
          >
            {saveSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Manual Trigger Card */}
      <Card className="rounded-lg border border-border">
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-medium">Zillow Scraper Control</CardTitle>
          <CardDescription className="text-[10px]">Manual trigger for finding new agents in a specific city.</CardDescription>
        </CardHeader>
        <CardContent className="pb-4 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Beverly Hills, CA"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-9 text-xs"
            />
            <Button
              size="sm"
              className="h-9 px-4 shrink-0"
              onClick={() => triggerMutation.mutate(location)}
              disabled={!location || triggerMutation.isPending}
            >
              {triggerMutation.isPending ? 'Starting...' : 'Run Scraper'}
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1.5">
              <RotateCcw className="h-3 w-3" />
              Recent Searches
            </h4>
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-[10px]">
                <thead className="bg-secondary border-b border-border">
                  <tr className="text-left text-muted-foreground font-medium">
                    <th className="px-3 py-1.5">Location</th>
                    <th className="px-3 py-1.5 text-center">Found</th>
                    <th className="px-3 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">Loading history...</td></tr>
                  ) : history?.length === 0 ? (
                    <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">No recent searches</td></tr>
                  ) : history?.map((h) => (
                    <tr key={h.id} className="hover:bg-secondary/50 transition-colors">
                      <td className="px-3 py-2 text-foreground font-medium">{h.location}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground font-mono">
                        {h.status === 'completed' ? h.agents_found : h.status === 'scraping' ? '...' : '-'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          title={h.status === 'failed' ? h.error_message : undefined}
                          className={cn(
                            "text-[8px] px-1 h-3.5 border-none font-medium",
                            h.status === 'completed' && "bg-emerald-50 text-emerald-700",
                            h.status === 'scraping' && "bg-amber-50 text-amber-700 animate-pulse",
                            h.status === 'failed' && "bg-rose-50 text-rose-700 cursor-help",
                            h.status === 'pending' && "bg-secondary text-muted-foreground"
                          )}
                        >
                          {h.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Stats Summary */}
      {filterStats && (
        <Card className="rounded-lg border border-border">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Agent Filter Stats</CardTitle>
            <CardDescription className="text-[10px]">Quality filters applied during AI processing</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-5 gap-3">
              <div className="text-center p-2 bg-secondary rounded">
                <div className="text-lg font-bold text-foreground">{filterStats.total}</div>
                <div className="text-[9px] text-muted-foreground uppercase">Total Scraped</div>
              </div>
              <div className="text-center p-2 bg-emerald-50 rounded">
                <div className="text-lg font-bold text-emerald-700">{filterStats.completed}</div>
                <div className="text-[9px] text-emerald-600 uppercase">Processed</div>
              </div>
              <div className="text-center p-2 bg-amber-50 rounded">
                <div className="text-lg font-bold text-amber-700">{filterStats.listing_ready}</div>
                <div className="text-[9px] text-amber-600 uppercase">In Queue</div>
              </div>
              <div className="text-center p-2 bg-rose-50 rounded">
                <div className="text-lg font-bold text-rose-700">{filterStats.filtered.total || 0}</div>
                <div className="text-[9px] text-rose-600 uppercase">Filtered Out</div>
              </div>
              <div className="text-center p-2 bg-secondary rounded">
                <div className="text-lg font-bold text-foreground">{filterStats.pending}</div>
                <div className="text-[9px] text-muted-foreground uppercase">Pending</div>
              </div>
            </div>

            {/* Breakdown of filters */}
            {filterStats.filtered.total > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-[9px] text-muted-foreground uppercase mb-2">Filter Breakdown</div>
                <div className="flex flex-wrap gap-2">
                  {filterStats.filtered.filtered_license_expired && (
                    <Badge variant="secondary" className="text-[9px]">
                      License Expired: {filterStats.filtered.filtered_license_expired}
                    </Badge>
                  )}
                  {filterStats.filtered.filtered_no_sales && (
                    <Badge variant="secondary" className="text-[9px]">
                      No Sales: {filterStats.filtered.filtered_no_sales}
                    </Badge>
                  )}
                  {filterStats.filtered.filtered_no_listings && (
                    <Badge variant="secondary" className="text-[9px]">
                      No Listings: {filterStats.filtered.filtered_no_listings}
                    </Badge>
                  )}
                  {filterStats.filtered.filtered_low_price && (
                    <Badge variant="secondary" className="text-[9px]">
                      Low Price: {filterStats.filtered.filtered_low_price}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};




const MarketingPipelineStats = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const retryFailuresMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any)
        .rpc('retry_failed_marketing_leads');
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['marketing-pipeline-stats'] });
      toast({ title: 'Retry Started', description: `Queued ${count} agents for re-processing.` });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const { data: pipelineStats } = useQuery({
    queryKey: ['marketing-pipeline-stats'],
    queryFn: async () => {
      // Get all cold_leads with marketing data
      const { data: leads, error } = await (supabase as any)
        .from('cold_leads')
        .select('id, first_name, last_name, experience_segment, processing_status, notes, email1_body, email1_sent, email1_opened_at, email2_body, email2_sent, email2_opened_at, email3_body, email3_sent, email3_opened_at, opted_out_at, landing_project_id')
        .not('landing_project_id', 'is', null);

      if (error) throw error;
      const leadsData = leads || [];

      // Get count of skipped leads (insufficient photos) from analyzed_agents
      const { count: skippedCount, error: skippedError } = await supabase
        .from('analyzed_agents')
        .select('*', { count: 'exact', head: true })
        .eq('processing_status', 'insufficient_photos');

      if (skippedError) console.error("Error fetching skipped count:", skippedError);

      // Diagnostic: Get all status counts from analyzed_agents
      const { data: allStatuses, error: statusError } = await supabase
        .from('analyzed_agents')
        .select('processing_status');

      const statusCounts: Record<string, number> = {};
      if (!statusError && allStatuses) {
        allStatuses.forEach((s: any) => {
          statusCounts[s.processing_status] = (statusCounts[s.processing_status] || 0) + 1;
        });
      }

      // Calculate totals
      const totalLeads = leadsData.length;

      // Fully ready = has ALL 3 emails + first/last name + landing_project_id
      const fullyReadyLeads = leadsData.filter((l: any) =>
        l.processing_status === 'ready' &&
        l.email1_body && l.email1_body.length > 20 &&
        l.email2_body && l.email2_body.length > 20 &&
        l.email3_body && l.email3_body.length > 20 &&
        l.first_name && l.first_name.trim() !== '' &&
        l.last_name && l.last_name.trim() !== '' &&
        l.landing_project_id
      );

      // Awaiting first email = fully ready but email1_sent is null
      const awaitingFirstEmail = fullyReadyLeads.filter((l: any) => !l.email1_sent).length;
      const fullyReady = fullyReadyLeads.length;

      // Partial = has at least email1 but missing email2 or email3
      const partialReady = leadsData.filter((l: any) =>
        l.processing_status === 'ready' &&
        l.email1_body && l.email1_body.length > 20 &&
        (!l.email2_body || l.email2_body.length <= 20 || !l.email3_body || l.email3_body.length <= 20)
      ).length;

      const packagesFailed = leadsData.filter((l: any) => l.processing_status === 'failed').length;

      // Count emails sent (have sent timestamp), opened, etc
      let emailsSent = 0;
      let emailsOpened = 0;
      leadsData.forEach((l: any) => {
        if (l.email1_sent) { emailsSent++; if (l.email1_opened_at) emailsOpened++; }
        if (l.email2_sent) { emailsSent++; if (l.email2_opened_at) emailsOpened++; }
        if (l.email3_sent) { emailsSent++; if (l.email3_opened_at) emailsOpened++; }
      });

      const optedOut = leadsData.filter((l: any) => l.opted_out_at).length;

      // Fetch landing analytics
      let totalLandingViews = 0;
      let uniqueVisitors = 0;
      let leadsClicked = 0;
      let claimsClicked = 0;
      try {
        const { data: analyticsData, error: analyticsError } = await (supabase as any)
          .from('outreach_email_analytics')
          .select('total_views, unique_visitors, clicked_from_email');

        if (!analyticsError && analyticsData) {
          analyticsData.forEach((a: any) => {
            totalLandingViews += (a.total_views || 0);
            uniqueVisitors += (a.unique_visitors || 0);
            if (a.clicked_from_email) leadsClicked++;
          });
        }

        // Fetch Claim button clicks
        const { count: claimsCount, error: claimsError } = await (supabase as any)
          .from('cta_click_events')
          .select('*', { count: 'exact', head: true })
          .eq('cta_type', 'claim_page');

        if (!claimsError) {
          claimsClicked = claimsCount || 0;
        }

      } catch (e) {
        console.error('Analytics query error:', e);
      }

      // Group by experience segment
      const segments: Record<string, { total: number; sent: number; opened: number }> = {};
      leadsData.forEach((l: any) => {
        const seg = l.experience_segment || 'unknown';
        if (!segments[seg]) segments[seg] = { total: 0, sent: 0, opened: 0 };
        segments[seg].total++;
        if (l.email1_sent) {
          segments[seg].sent++;
          if (l.email1_opened_at) segments[seg].opened++;
        }
      });

      return {
        totalLeads,
        fullyReady,
        awaitingFirstEmail,
        partialReady,
        packagesFailed,
        packagesSkipped: skippedCount || 0,
        emailsSent,
        emailsOpened,
        optedOut,
        segments,
        leadsData,
        pendingAiCount: statusCounts['listing_ready'] || 0,
        statusCounts,
        // Landing analytics
        totalLandingViews,
        uniqueVisitors,
        leadsClicked,
        claimsClicked
      };
    },
    refetchInterval: 60000
  });

  const stats = pipelineStats || {
    totalLeads: 0,
    fullyReady: 0,
    awaitingFirstEmail: 0,
    partialReady: 0,
    packagesFailed: 0,
    packagesSkipped: 0,
    emailsSent: 0,
    emailsOpened: 0,
    optedOut: 0,
    segments: {},
    leadsData: [],
    pendingAiCount: 0,
    statusCounts: {} as Record<string, number>,
    totalLandingViews: 0,
    uniqueVisitors: 0,
    leadsClicked: 0,
    claimsClicked: 0
  };
  const openRate = stats.emailsSent > 0 ? Math.round((stats.emailsOpened / stats.emailsSent) * 100) : 0;

  // Calculate filtered agents count
  const filteredCount = Object.entries(stats.statusCounts)
    .filter(([key]) => key.startsWith('filtered_'))
    .reduce((sum, [, count]) => sum + count, 0);

  const segmentList = Object.entries(stats.segments).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-4 w-full">
      <h3 className="text-sm text-foreground">Marketing Pipeline</h3>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-2 gap-2 md:gap-4 md:grid-cols-3 lg:grid-cols-7">
        <StatCard label="Leads Added" value={stats.totalLeads} />
        <StatCard label="Ready" value={stats.fullyReady} helper="3 emails + site" />
        <StatCard label="Awaiting 1st" value={stats.awaitingFirstEmail} helper="ready, not sent" />
        <StatCard label="Emails Sent" value={stats.emailsSent} />
        <StatCard label="Landing Views" value={stats.totalLandingViews} helper={`${stats.uniqueVisitors} unique`} />
        <StatCard label="Leads Clicked" value={stats.leadsClicked} helper={stats.emailsSent > 0 ? `${Math.round((stats.leadsClicked / stats.emailsSent) * 100)}%` : '0%'} />
        <StatCard label="Claims Clicked" value={stats.claimsClicked} />
      </div>

      {/* Activity Trends Chart */}
      <ActivityTrendsChart />

      {/* Landing Views Analytics Table */}
      <LandingViewsAnalytics />

      {/* Diagnostic Row: AI Agent Statuses */}
      {Object.keys(stats.statusCounts).length > 0 && (
        <div className="flex flex-wrap gap-2 items-center text-[10px] text-muted-foreground bg-secondary/50 p-2 rounded-lg border border-border">
          <span className="font-semibold uppercase tracking-wider mr-2">Agent Statuses (DB):</span>
          {Object.entries(stats.statusCounts).map(([status, count]) => (
            <div key={status} className="flex items-center gap-1.5 px-2 py-0.5 bg-card border border-border rounded-full">
              <span className="text-muted-foreground font-medium">{status}:</span>
              <span className="text-foreground">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Segment Analysis */}
      {segmentList.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs text-muted-foreground">Segment Performance</h4>
          <Card className="rounded-lg border border-border">
            <div className="grid grid-cols-4 gap-2 bg-secondary px-4 py-2 text-[10px] text-muted-foreground uppercase border-b border-border">
              <div>Segment</div>
              <div>Leads</div>
              <div>Opened</div>
              <div>Open Rate</div>
            </div>
            <div className="divide-y divide-border">
              {segmentList.map(([seg, data]) => {
                const segOpenRate = data.total > 0 ? Math.round((data.opened / data.total) * 100) : 0;
                return (
                  <div key={seg} className="grid grid-cols-4 gap-2 px-4 py-2 text-xs">
                    <div className="text-foreground capitalize">{seg.replace(/_/g, ' ')}</div>
                    <div className="text-muted-foreground">{data.total}</div>
                    <div className="text-muted-foreground">{data.opened}</div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-secondary rounded overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded" style={{ width: `${segOpenRate}%` }} />
                      </div>
                      <span className="text-muted-foreground w-8">{segOpenRate}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Failures List */}
      {stats.packagesFailed > 0 && stats.leadsData && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs text-rose-600 font-medium">Recent AI Failures</h4>
            <button
              onClick={() => {
                if (confirm(`Retry all ${stats.packagesFailed} failed AI tasks?`)) {
                  retryFailuresMutation.mutate();
                }
              }}
              className="text-[10px] text-muted-foreground hover:text-muted-foreground underline underline-offset-2 transition-colors"
              disabled={retryFailuresMutation.isPending}
            >
              {retryFailuresMutation.isPending ? 'Queuing...' : `Retry All ${stats.packagesFailed}`}
            </button>
          </div>
          <div className="space-y-1">
            {stats.leadsData.filter((l: any) => l.processing_status === 'failed').slice(0, 5).map((l: any) => (
              <div key={l.id} className="text-[10px] bg-rose-50 border border-rose-100 rounded px-2 py-1 flex justify-between">
                <span className="font-medium text-rose-900">{l.first_name || 'Unnamed Agent'} {l.last_name || ''}</span>
                <span className="text-rose-700 italic">{l.notes || 'Unknown error during generation'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Pipeline Control - enable/disable lead pipelines
const PipelineControl = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch pipeline settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['pipeline-settings'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('outreach_pipeline_settings')
        .select('*');
      if (error) throw error;
      return data as { pipeline_type: string; enabled: boolean }[];
    }
  });

  // Fetch counts per pipeline (from ACTUAL TASKS in queue)
  const { data: counts } = useQuery({
    queryKey: ['pipeline-counts'],
    queryFn: async () => {
      // Join tasks with leads to get pipeline_type
      const { data, error } = await (supabase as any)
        .from('outreach_email_tasks')
        .select('id, cold_leads!inner(pipeline_type, processing_status, first_name, last_name)')
        .eq('status', 'queued')
        .eq('cold_leads.processing_status', 'ready')
        .not('cold_leads.first_name', 'is', null)
        .neq('cold_leads.first_name', '')
        .not('cold_leads.last_name', 'is', null)
        .neq('cold_leads.last_name', '');
      if (error) throw error;

      const result: Record<string, number> = { legacy: 0, marketing: 0 };
      (data || []).forEach((t: any) => {
        const pt = t.cold_leads?.pipeline_type || 'legacy';
        result[pt] = (result[pt] || 0) + 1;
      });
      return result;
    },
    refetchInterval: 10000 // refresh every 10s to show progress
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ pipelineType, enabled }: { pipelineType: string; enabled: boolean }) => {
      const { error } = await (supabase as any)
        .from('outreach_pipeline_settings')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('pipeline_type', pipelineType);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-settings'] });
      toast({ title: 'Updated', description: 'Pipeline setting saved.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  // Clear Queue mutation
  const clearQueueMutation = useMutation({
    mutationFn: async (pipelineType: string) => {
      const { data, error } = await (supabase as any)
        .rpc('clear_pipeline_queue', { p_pipeline_type: pipelineType });
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-counts'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-pipeline-stats'] });
      toast({ title: 'Queue Cleared', description: `Removed ${count} tasks from queue.` });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  // Global Reset mutation
  const resetAllMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any)
        .rpc('reset_all_outreach_tasks');
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-counts'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-pipeline-stats'] });
      toast({ title: 'Global Reset', description: `Cleared all ${count} tasks.` });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const getSettingEnabled = (type: string) => {
    return settings?.find((s) => s.pipeline_type === type)?.enabled ?? true;
  };

  if (isLoading) return <div className="text-[10px] text-muted-foreground">Loading pipeline settings...</div>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs text-muted-foreground">Pipeline Control</h4>
        <button
          onClick={() => {
            if (confirm('DANGER: Reset EVERYTHING in the outreach queue (all history and pending tasks)?')) {
              resetAllMutation.mutate();
            }
          }}
          className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors uppercase tracking-wider"
          disabled={resetAllMutation.isPending}
        >
          {resetAllMutation.isPending ? 'Resetting...' : 'Emergency Global Reset'}
        </button>
      </div>

      <Card className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-3 gap-2 bg-secondary px-4 py-2 text-[10px] text-muted-foreground uppercase border-b border-border">
          <div>Pipeline</div>
          <div className="text-center">In Queue</div>
          <div className="text-right">Active</div>
        </div>
        <div className="divide-y divide-border">
          {[
            { type: 'legacy', label: 'Legacy (Old Leads)' },
            { type: 'marketing', label: 'Marketing (New Leads)' }
          ].map(({ type, label }) => (
            <div key={type} className="grid grid-cols-3 gap-2 px-4 py-3 text-xs items-center hover:bg-secondary transition-colors">
              <div className="text-foreground flex flex-col gap-1">
                <span className="font-medium">{label}</span>
                <button
                  onClick={() => {
                    if (confirm(`Delete ALL queued tasks for ${label}?`)) {
                      clearQueueMutation.mutate(type);
                    }
                  }}
                  className="text-[10px] text-red-400 hover:text-red-600 text-left w-fit underline decoration-red-400/30"
                  disabled={clearQueueMutation.isPending}
                >
                  Clear this queue
                </button>
              </div>
              <div className="text-muted-foreground text-center font-mono">{counts?.[type] ?? 0}</div>
              <div className="flex justify-end">
                <Switch
                  checked={getSettingEnabled(type)}
                  onCheckedChange={(checked) => toggleMutation.mutate({ pipelineType: type, enabled: checked })}
                  disabled={toggleMutation.isPending}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

const ControlCenterTab = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const retryFailuresMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any)
        .rpc('retry_failed_marketing_leads');
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries();
      toast({ title: 'Retry Started', description: `Queued ${count} agents for re-processing.` });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const triggerProcessorMutation = useMutation({
    mutationFn: async (kind: 'fetch-listings' | 'process-agent') => {
      const { data, error } = await (supabase as any).functions.invoke(kind, { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, kind) => {
      toast({ title: 'Job Triggered', description: `Successfully started ${kind} task.` });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  // 1. Health Metrics
  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      // Mock ping to OpenAI (in real app, we could call a small edge function)
      const start = Date.now();
      const status = {
        openai: 'stable',
        database: 'healthy',
        latency: 0,
        pipeline_velocity: 12 // items/hr
      };

      try {
        const res = await fetch('https://api.openai.com/v1/models', { method: 'HEAD' });
        status.latency = Date.now() - start;
        if (!res.ok) status.openai = 'degraded';
      } catch (e) {
        status.openai = 'offline';
      }

      return status;
    },
    refetchInterval: 30000 // every 30s
  });

  // 2. Activity Feed
  const { data: activities, isLoading: activityLoading } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: async () => {
      // Combined feed from analyzed_agents and cold_leads
      const [agentsRes, leadsRes] = await Promise.all([
        (supabase as any).from('analyzed_agents').select('id, unique_key, processing_status, created_at').order('created_at', { ascending: false }).limit(10),
        (supabase as any).from('cold_leads').select('id, name, processing_status, notes, created_at').order('created_at', { ascending: false }).limit(10)
      ]);

      const events = [
        ...((agentsRes.data as any[]) || []).map(a => ({
          id: `agent-${a.id}`,
          type: 'ingestion',
          title: 'Zillow Scraper',
          target: a.unique_key || 'Unknown Agent',
          status: a.processing_status,
          time: a.created_at
        })),
        ...((leadsRes.data as any[]) || []).map(l => ({
          id: `lead-${l.id}`,
          type: 'generation',
          title: 'Email AI',
          target: l.name || 'Unknown Lead',
          status: l.processing_status,
          notes: l.notes,
          time: l.created_at
        }))
      ];

      return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    },
    refetchInterval: 10000 // every 10s
  });

  return (
    <div className="space-y-6">
      {/* Health Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-3 rounded-lg border border-border p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-3">System Status</div>
          <div className="flex items-center gap-8">
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase">OpenAI</div>
              <div className="flex items-center gap-1.5">
                <div className={cn("h-1.5 w-1.5 rounded-full",
                  health?.openai === 'stable' ? "bg-emerald-500" : "bg-red-500"
                )} />
                <span className="text-xs text-foreground">
                  {health?.openai === 'stable' ? 'OK' : 'Error'}
                </span>
              </div>
            </div>
            <div className="h-6 w-px bg-secondary" />
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase">Database</div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-foreground">OK</span>
              </div>
            </div>
            <div className="h-6 w-px bg-secondary" />
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase">Latency</div>
              <div className="text-xs text-foreground tabular-nums">{health?.latency}ms</div>
            </div>
          </div>
        </Card>

        <Card className="rounded-lg border border-border p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Throughput</div>
          <div className="text-lg text-foreground">{health?.pipeline_velocity} <span className="text-xs text-muted-foreground">leads/hr</span></div>
          <div className="w-full h-1 bg-secondary rounded mt-2">
            <div className="w-2/3 h-full bg-muted-foreground rounded" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Activity Feed */}
        <div className="space-y-3">
          <h3 className="text-sm text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Activity Feed
          </h3>
          <Card className="rounded-lg border border-border">
            <ScrollArea className="h-[400px]">
              <div className="divide-y divide-border">
                {activityLoading ? (
                  <div className="p-8 text-center text-muted-foreground text-xs">Loading...</div>
                ) : (activities as any[])?.map((event: any) => (
                  <div key={event.id} className="p-3 hover:bg-secondary transition-colors">
                    <div className="flex gap-3">
                      <div className={cn(
                        "h-6 w-6 rounded flex items-center justify-center flex-shrink-0",
                        event.type === 'ingestion' ? "bg-secondary" : "bg-secondary"
                      )}>
                        {event.status === 'ready' || event.status === 'completed' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : event.status === 'failed' ? (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-muted-foreground uppercase">{event.title}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(event.time).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-xs text-foreground truncate">
                          {event.type === 'ingestion' ? `Scanned: ${event.target}` : `Drafted: ${event.target}`}
                        </div>
                        {event.notes && (
                          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-1">{event.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {!activityLoading && (activities as any[])?.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-xs">No activity</div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Diagnostic Tools */}
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm text-foreground flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              Diagnostics
            </h3>
            <Card className="rounded-lg border border-border p-4 space-y-4">
              <div className="space-y-2">
                <div className="text-[10px] text-muted-foreground uppercase">Manual Actions</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-9 rounded text-[10px] uppercase font-medium tracking-wide"
                    onClick={() => triggerProcessorMutation.mutate('process-agent')}
                    disabled={triggerProcessorMutation.isPending}
                  >
                    {triggerProcessorMutation.isPending ? 'Working...' : 'Trigger AI Emailer'}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 rounded text-[10px] uppercase font-medium tracking-wide"
                    onClick={() => retryFailuresMutation.mutate()}
                    disabled={retryFailuresMutation.isPending}
                  >
                    {retryFailuresMutation.isPending ? 'Retrying...' : 'Retry AI Failures'}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 rounded text-[10px] uppercase font-medium tracking-wide col-span-2"
                    onClick={() => triggerProcessorMutation.mutate('fetch-listings')}
                    disabled={triggerProcessorMutation.isPending}
                  >
                    Trigger Listing Fetcher
                  </Button>
                </div>
              </div>

              <div className="pt-3 border-t border-border space-y-2">
                <div className="text-[10px] text-muted-foreground uppercase">Trace Agent</div>
                <div className="flex gap-2">
                  <Input
                    placeholder="agent_uuid..."
                    className="h-8 text-xs rounded border-border"
                  />
                  <Button variant="outline" className="h-8 px-3 rounded text-xs">
                    Search
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm text-foreground flex items-center gap-2">
              <Code className="h-4 w-4 text-muted-foreground" />
              Variable Inspector
            </h3>
            <Card className="rounded-lg border border-border p-4 space-y-3">
              <div className="text-[10px] text-muted-foreground uppercase">Substitution Test</div>
              <p className="text-xs text-muted-foreground">
                Test prompt variables against real agent data.
              </p>
              <Button variant="outline" className="w-full h-8 rounded text-xs">
                Open Inspector
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// Calls Manager - Spanish Voice Pipeline
const CallsManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. Fetch Queue Stats
  const { data: queueStats } = useQuery({
    queryKey: ['call-queue-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_queue')
        .select('status, next_attempt_at');

      if (error) throw error;

      const stats = {
        pending: 0,
        calling: 0,
        completed: 0,
        exhausted: 0,
        scheduled_today: 0
      };

      const todayStr = new Date().toISOString().split('T')[0];

      (data || []).forEach((item: any) => {
        const s = item.status as keyof typeof stats;
        if (stats[s] !== undefined) stats[s]++;

        if (item.next_attempt_at && item.next_attempt_at.startsWith(todayStr)) {
          stats.scheduled_today++;
        }
      });
      return stats;
    },
    refetchInterval: 5000
  });

  // 2. Fetch Active Queue (all non-completed)
  const { data: queueItems } = useQuery({
    queryKey: ['call-queue-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_queue')
        .select('*')
        .in('status', ['pending', 'calling', 'retry'])
        .order('next_attempt_at', { ascending: true })
        .limit(20);
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000
  });

  // 2.1 Fetch ALL scheduled calls for today (regardless of status)
  const { data: scheduledToday } = useQuery({
    queryKey: ['call-queue-scheduled-today'],
    queryFn: async () => {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const { data, error } = await supabase
        .from('call_queue')
        .select('*')
        .gte('next_attempt_at', startOfDay)
        .lt('next_attempt_at', endOfDay)
        .order('next_attempt_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000
  });

  // 3. Fetch Call History with all available columns
  const { data: callHistory } = useQuery({
    queryKey: ['vapi-call-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vapi_call_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000
  });

  // Audio player state
  const [playingCallId, setPlayingCallId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayRecording = (callId: string, recordingUrl: string) => {
    if (playingCallId === callId) {
      audioRef.current?.pause();
      setPlayingCallId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(recordingUrl);
      audioRef.current.play();
      audioRef.current.onended = () => setPlayingCallId(null);
      setPlayingCallId(callId);
    }
  };

  // Mutation to force-process queue
  const processQueueMutation = useMutation({
    mutationFn: async (opts?: { force?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('process-call-queue', {
        body: opts || {}
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Queue Processed',
        description: `Processed ${data.processed || 0} calls. ${data.message || ''}`
      });
      queryClient.invalidateQueries({ queryKey: ['call-queue-stats'] });
      queryClient.invalidateQueries({ queryKey: ['call-queue-active'] });
      queryClient.invalidateQueries({ queryKey: ['vapi-call-history'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  // Mutation to reset test data
  const resetDataMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-agent-es', {
        body: { action: 'reset_test_data' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Data Reset', description: 'Agent statuses reset to listing_ready.' });
    }
  });

  // Mutation to run real scraper
  const runScraperMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('schedule-scraper-es', {
        body: { location: "Marbella" } // Hardcoded popular location for testing
      });
      if (error) throw error;
      return data;
    }
  });

  // Test Runner State
  const [testStage, setTestStage] = useState<'idle' | 'scraping' | 'waiting' | 'processing' | 'dialing' | 'completed'>('idle');
  const [testLog, setTestLog] = useState<string[]>([]);

  const addLog = (msg: string) => setTestLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

  const runFullTest = async () => {
    try {
      setTestStage('scraping');
      setTestLog([]);
      addLog("Starting Real World Test...");

      let foundAgent = null;

      // Step 0: Check DB for existing agents (skip scrape if possible)
      addLog("Checking DB for existing unprocessed agents...");
      // We look for ANY Idealista agent. We prefer ones created recently, but will take anyone.
      const { data: existingAgents } = await supabase
        .from('analyzed_agents')
        .select('*')
        .eq('source', 'idealista')
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingAgents && existingAgents.length > 0) {
        foundAgent = existingAgents[0];
        addLog(`Found existing agent: ${foundAgent.agency_name || 'Unknown'}. Skipping scraper.`);
      } else {
        // Step 1: Trigger Scraper
        addLog("No existing agents found. Step 1: Triggering Idealista Scraper (Marbella)...");
        await runScraperMutation.mutateAsync();
        addLog("Scraper started via Apify. Waiting for results (this may take 60-90s)...");

        setTestStage('waiting');

        // Step 2: Poll for new agents
        let attempts = 0;
        const maxAttempts = 24; // 2 minutes (5s interval)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        while (!foundAgent && attempts < maxAttempts) {
          attempts++;
          await new Promise(r => setTimeout(r, 5000)); // Wait 5s

          const { data } = await supabase
            .from('analyzed_agents')
            .select('*')
            .eq('source', 'idealista')
            .gt('created_at', fiveMinutesAgo)
            .limit(1);

          if (data && data.length > 0) {
            foundAgent = data[0];
            addLog(`Step 2: Found new agent! (${foundAgent.agency_name})`);
          }
        }

        if (!foundAgent) {
          throw new Error("Timeout: No new agents found after 2 minutes. Apify might be slow or blocked.");
        }
      }

      // Step 3: Process Agent
      setTestStage('processing');
      addLog(`Step 3: Processing agent ${foundAgent.id}...`);

      await supabase.functions.invoke('process-agent-es', {
        body: { agent_id: foundAgent.id }
      });
      addLog("Agent processed & Call queued.");

      // Step 4: Dial
      setTestStage('dialing');
      addLog("Step 4: Forcing Call to your phone...");
      await processQueueMutation.mutateAsync({ force: true });

      setTestStage('completed');
      addLog("SUCCESS! Answer the call -> Say 'Yes' -> Check SMS for website.");
      toast({ title: "Test Call Initiated", description: "Answer your phone now!" });

    } catch (e: any) {
      setTestStage('idle');
      addLog(`ERROR: ${e.message}`);
      toast({ title: "Test Failed", description: e.message, variant: "destructive" });
    }
  };

  const runFullTestOld = async () => {
    try {
      setTestStage('scraping');
      setTestLog([]);
      addLog("Starting Real World Test...");

      // Step 1: Trigger Scraper
      addLog("Step 1: Triggering Idealista Scraper (Marbella)...");
      await runScraperMutation.mutateAsync();
      addLog("Scraper started via Apify. Waiting for results (this may take 60-90s)...");

      setTestStage('waiting');

      // Step 2: Poll for new agents
      let foundAgent = null;
      let attempts = 0;
      const maxAttempts = 24; // 2 minutes (5s interval)

      while (!foundAgent && attempts < maxAttempts) {
        attempts++;
        await new Promise(r => setTimeout(r, 5000)); // Wait 5s

        // Check for ANY ready or pending agent created in the last 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from('analyzed_agents')
          .select('*')
          .eq('source', 'idealista')
          .gt('created_at', fiveMinutesAgo)
          .limit(1);

        if (data && data.length > 0) {
          foundAgent = data[0];
          addLog(`Step 2: Found new agent! (${foundAgent.agency_name})`);
        } else {
          // Optional: check if we have ANY pending agent regardless of time if scraping takes too long?
          // For now, strict "fresh" check.
        }
      }

      if (!foundAgent) {
        throw new Error("Timeout: No new agents found after 2 minutes. Apify might be slow or blocked.");
      }

      // Step 3: Process Agent
      setTestStage('processing');
      addLog(`Step 3: Processing agent ${foundAgent.id}...`);

      // We call process-agent-es. Note: we need to make sure process-agent-es picks THIS agent.
      // Currently process-agent-es picks "pending" agents. 
      // To be safe, let's call it specifically for this agent if the function supports it, 
      // OR just generic call since he is pending. 
      // The function supports { agent_id }!
      await supabase.functions.invoke('process-agent-es', {
        body: { agent_id: foundAgent.id }
      });
      addLog("Agent processed & Call queued.");

      // Step 4: Dial
      setTestStage('dialing');
      addLog("Step 4: Forcing Call to your phone...");
      await processQueueMutation.mutateAsync({ force: true });

      setTestStage('completed');
      addLog("SUCCESS! Answer the call -> Say 'Yes' -> Check SMS for website.");
      toast({ title: "Test Call Initiated", description: "Answer your phone now!" });

    } catch (e: any) {
      setTestStage('idle');
      addLog(`ERROR: ${e.message}`);
      toast({ title: "Test Failed", description: e.message, variant: "destructive" });
    }
  };

  // Mutation to test-enqueue (pick random agent)
  const testEnqueueMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-agent-es', {
        body: {} // Empty body triggers fallback "pick ready agent" logic
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Test Enqueue Triggered',
        description: data.success ? `Enqueued: ${data.agentName || 'Unknown'}` : `Result: ${JSON.stringify(data)}`
      });
      queryClient.invalidateQueries({ queryKey: ['call-queue-stats'] });
      queryClient.invalidateQueries({ queryKey: ['call-queue-active'] });
    },
    onError: (err: any) => {
      toast({ title: 'Enqueue Failed', description: err.message, variant: 'destructive' });
    }
  });

  return (
    <div className="space-y-6" >
      {/* Test Runner Card */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Real World E2E Test Runner
            {testStage !== 'idle' && <span className="text-xs font-normal px-2 py-0.5 bg-primary/20 text-primary rounded-full animate-pulse">Running...</span>}
          </CardTitle>
          <CardDescription>
            Runs the full pipeline: Real Scrape → Wait → Process → Call → Site Generation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {testStage === 'idle' ? (
            <div className="flex gap-4">
              <Button onClick={runFullTest} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Run Full Real World Test
              </Button>
              {/* Manual Reset Button (restored) */}
              <Button
                variant="outline"
                onClick={() => resetDataMutation.mutate()}
                disabled={resetDataMutation.isPending}
              >
                {resetDataMutation.isPending ? 'Resetting...' : 'Reset Test Data'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Progress UI */}
              <div className="flex justify-between text-sm mb-2">
                <div className={`px-3 py-1 rounded ${testStage === 'scraping' ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground'}`}>1. Scrape</div>
                <div className={`px-3 py-1 rounded ${testStage === 'waiting' ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground'}`}>2. Wait</div>
                <div className={`px-3 py-1 rounded ${testStage === 'processing' ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground'}`}>3. Process</div>
                <div className={`px-3 py-1 rounded ${testStage === 'dialing' ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-muted-foreground'}`}>4. Dial</div>
              </div>

              <div className="bg-card p-3 rounded-md border h-32 overflow-y-auto font-mono text-xs shadow-inner">
                {testLog.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            </div>
          )}
        </CardContent>
      </Card >

      {/* KPI Cards */}
      < div className="grid grid-cols-2 md:grid-cols-4 gap-4" >
        <StatCard label="Pending in Queue" value={queueStats?.pending || 0} helper="Waiting for window" />
        <StatCard label="Scheduled Today" value={queueStats?.scheduled_today || 0} helper="Next 24h" />
        <StatCard label="Active Now" value={queueStats?.calling || 0} helper="In progress" />
        <StatCard label="Completed/Exhausted" value={(queueStats?.completed || 0) + (queueStats?.exhausted || 0)} helper="Finished" />
      </div >

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scheduled Today + Active Queue Column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Scheduled Today - Detailed View */}
          <Card className="rounded-lg border border-border">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Scheduled Today
                {scheduledToday && scheduledToday.length > 0 && (
                  <Badge className="bg-primary/20 text-primary ml-2">{scheduledToday.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(!scheduledToday || scheduledToday.length === 0) ? (
                <div className="text-xs text-muted-foreground text-center py-6">No calls scheduled for today</div>
              ) : (
                <div className="divide-y divide-border">
                  {scheduledToday.map((item: any) => (
                    <div key={item.id} className="px-4 py-3 hover:bg-secondary/50">
                      <div className="flex items-center justify-between mb-2">
                        {/* Left: Agent Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-foreground">{item.agent_name || 'Unknown'}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-secondary/50 border-border text-muted-foreground">
                              {item.phone}
                            </Badge>
                          </div>
                          {(item.agency_name || item.location) && (
                            <div className="text-[10px] text-muted-foreground mt-1 flex gap-2">
                              {item.agency_name && <span>{item.agency_name}</span>}
                              {item.agency_name && item.location && <span>•</span>}
                              {item.location && <span>{item.location}</span>}
                            </div>
                          )}
                          {/* Landing Page Link */}
                          {item.landing_url && (
                            <a
                              href={item.landing_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-primary hover:underline mt-1 flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View Landing Page
                            </a>
                          )}
                        </div>

                        {/* Right: Time + Attempt */}
                        <div className="text-right flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            {new Date(item.next_attempt_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={cn(
                              "text-[9px] px-1.5 py-0 h-4",
                              item.status === 'completed' ? "bg-emerald-500/20 text-emerald-400" :
                                item.status === 'calling' ? "bg-amber-500/20 text-amber-400" :
                                  item.status === 'exhausted' ? "bg-red-500/20 text-red-400" :
                                    "bg-secondary text-muted-foreground"
                            )}>
                              {item.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              Attempt {item.attempt_count || 1}/{item.max_attempts || 3}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Call Queue */}
          <Card className="rounded-lg border border-border">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Active Call Queue</CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => testEnqueueMutation.mutate()}
                  disabled={testEnqueueMutation.isPending}
                >
                  {testEnqueueMutation.isPending ? 'Enqueueing...' : 'Test Enqueue'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => processQueueMutation.mutate({ force: true })}
                  disabled={processQueueMutation.isPending}
                >
                  {processQueueMutation.isPending ? 'Processing...' : 'Force Process'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {(!queueItems || queueItems.length === 0) ? (
                <div className="text-xs text-muted-foreground text-center py-6">Queue is empty</div>
              ) : (
                <div className="divide-y divide-border">
                  {queueItems.map((item: any) => (
                    <div key={item.id} className="px-4 py-3 flex items-center justify-between hover:bg-secondary/50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs text-foreground">{item.agent_name || 'Unknown'}</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-border text-muted-foreground">
                            {item.phone}
                          </Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-2">
                          <span>{item.agency_name}</span>
                          <span>•</span>
                          <span>{item.location}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-medium text-muted-foreground">
                          {new Date(item.next_attempt_at).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                        </div>
                        <div className="mt-1">
                          <Badge className={cn(
                            "text-[9px] px-1.5 py-0 h-4",
                            item.status === 'calling' ? "bg-amber-100 text-amber-700" : "bg-secondary text-muted-foreground"
                          )}>
                            {item.status} ({item.attempt_count})
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Call History Column - Enhanced */}
        <div className="space-y-4">
          <Card className="rounded-lg border border-border h-full">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Recent Calls
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                {(!callHistory || callHistory.length === 0) ? (
                  <div className="text-xs text-muted-foreground text-center py-8">No calls yet</div>
                ) : (
                  <div className="divide-y divide-border">
                    {callHistory.map((call: any) => {
                      // Determine call outcome for display
                      const isInterested = call.call_result === 'interested';
                      const isBlacklisted = call.call_result === 'blacklisted';
                      const isNoAnswer = call.call_result === 'no_answer' || call.status === 'no_answer';
                      const needsLink = isInterested && !call.sms_sent;
                      const linkSent = isInterested && call.sms_sent;

                      return (
                        <div key={call.id} className="px-4 py-3 hover:bg-secondary/50">
                          {/* Header: Name + Time */}
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="text-xs font-medium text-foreground">{call.agent_name}</span>
                              {call.agent_phone && (
                                <span className="text-[9px] text-muted-foreground ml-2">{call.agent_phone}</span>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-[9px] text-muted-foreground">
                                {new Date(call.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                              </div>
                              <div className="text-[10px] font-medium text-foreground">
                                {new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>

                          {/* Status Row with Call Result */}
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className={cn(
                              "text-[8px] px-1.5 h-4 border-none",
                              call.status === 'completed' ? "bg-emerald-500/20 text-emerald-400" :
                                call.status === 'initiated' ? "bg-blue-500/20 text-blue-400" :
                                  call.status === 'failed' ? "bg-red-500/20 text-red-400" :
                                    "bg-secondary text-muted-foreground"
                            )}>
                              {call.status}
                            </Badge>

                            {/* Call Result Badge */}
                            {call.call_result && (
                              <Badge variant="outline" className={cn(
                                "text-[8px] px-1.5 h-4 border-none flex items-center gap-1",
                                isInterested ? "bg-emerald-500/20 text-emerald-400" :
                                  isBlacklisted ? "bg-red-500/20 text-red-400" :
                                    isNoAnswer ? "bg-amber-500/20 text-amber-400" :
                                      "bg-secondary text-muted-foreground"
                              )}>
                                {isInterested && <ThumbsUp className="h-2.5 w-2.5" />}
                                {isBlacklisted && <ThumbsDown className="h-2.5 w-2.5" />}
                                {isNoAnswer && <PhoneOff className="h-2.5 w-2.5" />}
                                {call.call_result}
                              </Badge>
                            )}

                            {call.duration_seconds && (
                              <span className="text-[9px] text-muted-foreground ml-auto">
                                {Math.floor(call.duration_seconds / 60)}:{String(call.duration_seconds % 60).padStart(2, '0')}
                              </span>
                            )}
                          </div>

                          {/* Link Status - Important for business logic */}
                          {
                            isInterested && (
                              <div className={cn(
                                "flex items-center gap-1.5 text-[10px] px-2 py-1 rounded mb-2",
                                linkSent ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                              )}>
                                {linkSent ? (
                                  <>
                                    <CheckCircle2 className="h-3 w-3" />
                                    Link sent
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle className="h-3 w-3" />
                                    Need to send link!
                                  </>
                                )}
                              </div>
                            )
                          }

                          {/* Transcript Summary if available */}
                          {
                            call.transcript_summary && (
                              <div className="text-[9px] text-muted-foreground bg-secondary/50 rounded p-2 mb-2 line-clamp-2">
                                <MessageCircle className="h-2.5 w-2.5 inline mr-1" />
                                {call.transcript_summary}
                              </div>
                            )
                          }

                          {/* Recording Button */}
                          {
                            call.recording_url && (
                              <Button
                                size="sm"
                                variant="outline"
                                className={cn(
                                  "h-6 text-[10px] px-2 w-full",
                                  playingCallId === call.id && "bg-primary/10 border-primary text-primary"
                                )}
                                onClick={() => handlePlayRecording(call.id, call.recording_url)}
                              >
                                {playingCallId === call.id ? (
                                  <>
                                    <Volume2 className="h-3 w-3 mr-1 animate-pulse" />
                                    Playing...
                                  </>
                                ) : (
                                  <>
                                    <Play className="h-3 w-3 mr-1" />
                                    Play Recording
                                  </>
                                )}
                              </Button>
                            )
                          }
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div >
  );
};

const OutreachDashboard = () => {
  const [activeView, setActiveView] = useState('overview');
  const [mobileTab, setMobileTab] = useState<'stats' | 'senders' | 'calls'>('stats');
  const [selectedMobileSender, setSelectedMobileSender] = useState<any>(null);
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [testEmailData, setTestEmailData] = useState<{ subject?: string, body?: string }>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const claimId = searchParams.get('claim_landing_id');
    console.log('[CLAIM DEBUG] useEffect triggered', { claimId, user: user?.email, hasUser: !!user });

    if (claimId && user) {
      console.log('[CLAIM DEBUG] Conditions met, calling claim-landing...');
      // Clear param immediately so we don't retry on refresh
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('claim_landing_id');
      setSearchParams(newParams);

      toast({ title: "Claiming your page...", description: "Please wait while we set up your account." });

      // Call Edge Function
      supabase.functions.invoke('claim-landing', {
        body: { landing_id: claimId }
      }).then(({ data, error }) => {
        console.log('[CLAIM DEBUG] Edge function response:', { data, error });
        if (error) {
          console.error("Claim failed", error);
          toast({ variant: "destructive", title: "Claim failed", description: "Could not assign property. Please contact support." });
        } else {
          toast({ title: "Success!", description: "Property successfully added to your account." });
          // Optional: invalidate queries to refresh project list
        }
      });
    } else {
      console.log('[CLAIM DEBUG] Conditions NOT met', { claimId, hasUser: !!user });
    }
  }, [user, searchParams, toast]);
  const isAllowed = !!user; // Require login
  const [drafts, setDrafts] = useState<Record<string, SenderAccount>>({});
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const outageNoticeEnabled = import.meta.env.VITE_PLATFORM_OUTAGE_NOTICE === 'true';
  const outageNoticeMessage =
    import.meta.env.VITE_PLATFORM_OUTAGE_MESSAGE ??
    'Supabase is reporting an ongoing incident. Expect delayed or failing requests until the provider resolves it.';

  const { data, isLoading, error, refetch, isFetching } = useQuery<SenderStats[]>({
    queryKey: ['outreach-sender-stats'],
    queryFn: async () => {
      const { data: rows, error: err } = await supabase
        .from('outreach_sender_stats')
        .select('*')
        .order('email', { ascending: true });
      if (err) throw err;
      return rows as any as SenderStats[];
    },
    enabled: isAllowed,
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
  });

  const {
    data: accounts,
    isLoading: accountsLoading,
    error: accountsError,
    refetch: refetchAccounts,
  } = useQuery<SenderAccount[]>({
    queryKey: ['outreach-sender-accounts'],
    queryFn: async () => {
      const { data: rows, error: err } = await supabase
        .from('outreach_sender_accounts')
        .select('email, daily_cap, is_active, notes, gap_min_sec, gap_max_sec, auto_gap, tz, work_days, w1_start, w1_end, w2_start, w2_end, w3_start, w3_end, win_jitter_min_sec, win_jitter_max_sec, w1_days, w2_days, w3_days')
        .order('email', { ascending: true });
      if (err) throw err;
      return rows as any as SenderAccount[];
    },
    enabled: isAllowed,
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
  });

  const updateAccount = useMutation({
    mutationFn: async (payload: SenderAccount) => {
      const { error: err } = await supabase
        .from('outreach_sender_accounts')
        .update({
          daily_cap: payload.daily_cap,
          is_active: payload.is_active,
          notes: payload.notes,
          gap_min_sec: payload.gap_min_sec,
          gap_max_sec: payload.gap_max_sec,
          auto_gap: payload.auto_gap,
          tz: payload.tz,
          work_days: payload.work_days?.map(Number) ?? null,
          w1_start: payload.w1_start,
          w1_end: payload.w1_end,
          w2_start: payload.w2_start,
          w2_end: payload.w2_end,
          w3_start: payload.w3_start,
          w3_end: payload.w3_end,
          win_jitter_min_sec: payload.win_jitter_min_sec,
          win_jitter_max_sec: payload.win_jitter_max_sec,
          w1_days: payload.w1_days,
          w2_days: payload.w2_days,
          w3_days: payload.w3_days,
        })
        .eq('email', payload.email);
      if (err) throw err;
    },
    onSuccess: () => {
      refetchAccounts();
      refetch();
    },
  });

  const { data: sentEmails, isLoading: sentLoading, error: sentError, refetch: refetchSent } = useQuery<SentEmail[]>({
    queryKey: ['outreach-sent-emails'],
    queryFn: async () => {
      const { data: rows, error: err } = await supabase
        .from('cold_leads')
        .select('name, email, email1_body, email1_sent, email1_opened_at, email2_body, email2_sent, email2_opened_at, email3_body, email3_sent, email3_opened_at')
        .or('email1_sent.not.is.null,email2_sent.not.is.null,email3_sent.not.is.null')
        .order('email1_sent', { ascending: false, nullsFirst: false })
        .limit(40);
      if (err) throw err;

      const flattened: SentEmail[] = [];
      (rows ?? []).forEach((row) => {
        const add = (
          step: 'email1' | 'email2' | 'email3',
          subject: string | null | undefined,
          body: string | null | undefined,
          sentAt: string | null | undefined,
          openedAt: string | null | undefined,
        ) => {
          if (!sentAt) return;
          flattened.push({
            lead_email: row.email,
            lead_name: row.name,
            subject: subject ?? '',
            body: body ?? '',
            sent_at: sentAt,
            step,
            opened_at: openedAt ?? null,
          });
        };
        add('email1', '', row.email1_body, row.email1_sent as string | null, row.email1_opened_at as string | null);
        add('email2', '', row.email2_body, row.email2_sent as string | null, row.email2_opened_at as string | null);
        add('email3', '', row.email3_body, row.email3_sent as string | null, row.email3_opened_at as string | null);
      });

      return flattened
        .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
        .slice(0, 40);
    },
    enabled: isAllowed,
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    if (accounts) {
      const next: Record<string, SenderAccount> = {};
      accounts.forEach((acc) => {
        next[acc.email] = { ...acc };
      });
      setDrafts(next);
    }
  }, [accounts]);

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const scheduleSave = (email: string, nextDraft: SenderAccount) => {
    if (saveTimers.current[email]) {
      clearTimeout(saveTimers.current[email]);
    }
    saveTimers.current[email] = setTimeout(() => {
      updateAccount.mutateAsync(nextDraft).catch(console.error);
    }, 400);
  };

  const updateDraft = (email: string, patch: Partial<SenderAccount>) => {
    setDrafts((prev) => {
      const base = prev[email] || accounts?.find((a) => a.email === email) || ({ email } as SenderAccount);
      const nextDraft = { ...base, ...patch };
      scheduleSave(email, nextDraft);
      return {
        ...prev,
        [email]: nextDraft,
      };
    });
  };

  const aggregates = useMemo(() => {
    if (!data) return { active: 0, ready: 0, sentToday: 0, queued: 0, sentTotal: 0, opensTotal: 0, unsubsTotal: 0 };

    return data.reduce(
      (acc, row) => {
        if (row.is_active) acc.active += 1;
        if (row.can_send_now) acc.ready += 1;
        acc.sentToday += row.sent_today ?? 0;
        acc.queued += (row.firsts_ready ?? 0) + (row.followups_ready ?? 0);
        acc.sentTotal += row.sent_total ?? 0;
        acc.opensTotal += row.opens_total ?? 0;
        acc.unsubsTotal += row.unsubs_total ?? 0;
        return acc;
      },
      { active: 0, ready: 0, sentToday: 0, queued: 0, sentTotal: 0, opensTotal: 0, unsubsTotal: 0 },
    );
  }, [data]);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginMode, setLoginMode] = useState<'signin' | 'signup'>('signin');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      console.log('[AUTH] Attempting', loginMode, 'with', loginEmail);
      const fn = loginMode === 'signin' ? signInWithEmail : signUpWithEmail;
      const { error } = await fn(loginEmail, loginPassword);

      console.log('[AUTH] Result:', error ? error.message : 'success');

      if (error) {
        setLoginError(error.message);
      } else if (loginMode === 'signup') {
        setLoginError('Check your email for confirmation link!');
      }
    } catch (err: any) {
      console.error('[AUTH] Exception:', err);
      setLoginError(err.message || 'Unknown error');
    }
    setLoginLoading(false);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-20 text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Vitrimo Admin</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {loginMode === 'signin' ? 'Sign in to continue' : 'Create an account'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="Email"
                  value={loginEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Password"
                  value={loginPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-11"
                />
              </div>
              {loginError && (
                <p className="text-sm text-red-500">{loginError}</p>
              )}
              <Button type="submit" className="w-full h-11" disabled={loginLoading}>
                {loginLoading ? 'Loading...' : loginMode === 'signin' ? 'Sign In' : 'Sign Up'}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full h-11"
              onClick={() => signInWithGoogle()}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {loginMode === 'signin' ? (
                <>Don't have an account? <button type="button" onClick={() => setLoginMode('signup')} className="text-primary hover:underline">Sign up</button></>
              ) : (
                <>Already have an account? <button type="button" onClick={() => setLoginMode('signin')} className="text-primary hover:underline">Sign in</button></>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }


  if (error) {
    return (
      <div className="mx-auto max-w-4xl py-16 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-rose-700">Failed to load stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>Supabase responded with an error: {error.message}</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar - Left (hidden on mobile) */}
      <aside className={cn(
        "hidden md:flex flex-shrink-0 bg-sidebar flex-col sticky top-0 h-screen overflow-y-auto transition-all duration-200",
        sidebarCollapsed ? "w-14" : "w-60"
      )}>
        {/* Logo/Title + Toggle */}
        <div className="h-12 flex items-center justify-between px-3">
          {!sidebarCollapsed && <span className="font-semibold text-foreground">Vitrimo Admin</span>}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors text-sidebar-foreground hover:text-foreground"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className={cn("p-3 flex-1", sidebarCollapsed && "px-2")}>
          <nav className="space-y-0.5">
            <NavItem
              icon={LayoutDashboard}
              label="Overview"
              active={activeView === 'overview'}
              onClick={() => setActiveView('overview')}
              isCollapsed={sidebarCollapsed}
            />
            <NavItem
              icon={Settings}
              label="Sender settings"
              active={activeView === 'settings'}
              onClick={() => setActiveView('settings')}
              isCollapsed={sidebarCollapsed}
            />
            <NavItem
              icon={Code}
              label="Prompts"
              active={activeView === 'prompts'}
              onClick={() => setActiveView('prompts')}
              isCollapsed={sidebarCollapsed}
            />
            <NavItem
              icon={Building2}
              label="Marketing Demos"
              active={activeView === 'demos'}
              onClick={() => setActiveView('demos')}
              isCollapsed={sidebarCollapsed}
            />
            <NavItem
              icon={Search}
              label="Scraper Control"
              active={activeView === 'scraper'}
              onClick={() => setActiveView('scraper')}
              isCollapsed={sidebarCollapsed}
            />
            <NavItem
              icon={Phone}
              label="Voice Agents (ES)"
              active={activeView === 'calls'}
              onClick={() => setActiveView('calls')}
              isCollapsed={sidebarCollapsed}
            />
            <NavItem
              icon={Video}
              label="Content Studio"
              active={activeView === 'content'}
              onClick={() => setActiveView('content')}
              isCollapsed={sidebarCollapsed}
            />
          </nav>
        </div>

        <div className={cn("p-3", sidebarCollapsed && "px-2")}>
          <div className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors",
            sidebarCollapsed && "justify-center px-0"
          )}>
            <div className="h-7 w-7 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center text-primary text-xs font-medium">
              {user?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-foreground truncate">{user?.email || 'Admin'}</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content - Desktop */}
      <main className="hidden md:flex flex-1 flex-col min-w-0">

        <div className="p-6 space-y-6 flex-1">
          {outageNoticeEnabled && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-4">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="text-xs text-amber-400 uppercase font-medium">Platform Advisory</p>
                <p className="text-sm text-foreground">{outageNoticeMessage}</p>
              </div>
            </div>
          )}

          <div>
            {activeView === 'overview' && (
              <div className="space-y-6">
                {/* Marketing Pipeline Stats */}
                <MarketingPipelineStats />
              </div>
            )}

            {activeView === 'emails' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm text-foreground">Sent Emails</h2>
                  <span className="text-xs text-muted-foreground">Last 40</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {((sentEmails as any[]) ?? []).map((item, idx) => (
                    <Card key={`${item.lead_email}-${item.sent_at}-${idx}`} className="rounded-lg border border-border p-4 flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <Badge className={cn(
                          "text-[10px] px-2 py-0.5",
                          item.opened_at ? 'bg-emerald-50 text-emerald-700' : 'bg-secondary text-muted-foreground'
                        )}>
                          {item.opened_at ? 'Opened' : 'Sent'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{formatDateTime(item.sent_at)}</span>
                      </div>
                      <div className="space-y-1 mb-3">
                        <div className="text-[10px] text-muted-foreground uppercase">{item.step} · {item.lead_email}</div>
                        <div className="text-sm text-foreground line-clamp-2">{item.subject || 'No Subject'}</div>
                      </div>
                      <div className="flex-1 whitespace-pre-wrap text-xs text-muted-foreground line-clamp-4">
                        {item.body.replace(/<br\s*\/>/gi, '\n').replace(/<[^>]+>/g, '')}
                      </div>
                    </Card>
                  ))}
                  {((sentEmails as any[]) ?? []).length === 0 && !sentLoading && (
                    <div className="col-span-full h-40 flex flex-col items-center justify-center border border-dashed border-border rounded-lg text-muted-foreground">
                      <Mail className="h-8 w-8 mb-2" />
                      <p className="text-xs">No emails</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeView === 'settings' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm text-foreground">Sender Settings</h2>
                </div>

                <Card className="rounded-lg border border-border">
                  <div className="space-y-3">
                    {((accounts as any[]) ?? []).map((row) => {
                      const draft = drafts[row.email] ?? row;
                      const stats = data?.find((s) => s.email === row.email);
                      const reasons = stats?.reasons ?? [];
                      const canSend = stats?.can_send_now ?? false;
                      const sentToday = stats?.sent_today ?? 0;
                      const remaining = stats?.remaining_today ?? 0;

                      return (
                        <div key={row.email} className="border border-border rounded-lg bg-card hover:shadow-sm transition-shadow">
                          {/* Compact Header Row - Clickable to expand/collapse */}
                          <div
                            className="px-4 py-3 flex items-center justify-between cursor-pointer select-none"
                            onClick={() => setExpandedCards(prev => ({ ...prev, [row.email]: !prev[row.email] }))}
                          >
                            <div className="flex items-center gap-3">
                              <div onClick={(e) => e.stopPropagation()}>
                                <Switch
                                  checked={draft.is_active}
                                  onCheckedChange={(checked) => updateDraft(row.email, { is_active: checked })}
                                  className="data-[state=checked]:bg-emerald-500 scale-90"
                                />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-foreground">{row.email}</div>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                  <span>{sentToday}/{draft.daily_cap} today</span>
                                  <span>•</span>
                                  <span>{remaining} left</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Status Badge */}
                              {(() => {
                                const windowOpen = stats?.window_open ?? true;
                                const isActive = draft.is_active;
                                const nextSlot = stats?.next_slot_utc || stats?.next_slot_cet;
                                // Check if there are tasks ready (by recipient timezone)
                                const hasReadyTasks = ((stats?.firsts_ready ?? 0) + (stats?.followups_ready ?? 0)) > 0;
                                const hasActiveQueue = stats?.has_active_queue ?? false;
                                const capReached = reasons.includes('daily_cap_reached');
                                const cooldown = reasons.includes('cooldown');

                                // Check if today is a work day for this sender
                                const workDays = draft.work_days ?? row.work_days ?? ["1", "2", "3", "4", "5"];
                                const todayDayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon, etc.
                                const isWorkDay = workDays.map(String).includes(String(todayDayOfWeek));

                                // Calculate countdown to next slot
                                const getCountdown = () => {
                                  if (!nextSlot) return null;
                                  const nextTime = new Date(nextSlot).getTime();
                                  const now = Date.now();
                                  const diff = nextTime - now;
                                  if (diff <= 0) return null;

                                  const hours = Math.floor(diff / (1000 * 60 * 60));
                                  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

                                  if (hours > 0) return `${hours}h ${mins}m`;
                                  return `${mins}m`;
                                };

                                // Determine status: Ready, Sending, Waiting, Day off, or Paused
                                if (!isActive) {
                                  return (
                                    <div className="px-2 py-1 rounded text-[10px] font-medium bg-secondary text-muted-foreground">
                                      Paused
                                    </div>
                                  );
                                }

                                // Day off check - show before other statuses
                                if (!isWorkDay) {
                                  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                  return (
                                    <div className="px-2 py-1 rounded text-[10px] font-medium bg-violet-500/15 text-violet-400">
                                      Day off ({dayNames[todayDayOfWeek]})
                                    </div>
                                  );
                                }

                                if (capReached) {
                                  return (
                                    <div className="px-2 py-1 rounded text-[10px] font-medium bg-rose-500/15 text-rose-400">
                                      Cap reached
                                    </div>
                                  );
                                }

                                if (hasActiveQueue) {
                                  return (
                                    <div className="px-2 py-1 rounded text-[10px] font-medium bg-blue-500/15 text-blue-400">
                                      Sending...
                                    </div>
                                  );
                                }

                                // Ready if there are tasks that match recipient timezone (even if sender window is "closed")
                                if (hasReadyTasks && !cooldown) {
                                  return (
                                    <div className="px-2 py-1 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400">
                                      Ready
                                    </div>
                                  );
                                }

                                // Waiting - no tasks ready or cooldown active
                                const countdown = getCountdown();
                                return (
                                  <div className="px-2 py-1 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400">
                                    Waiting{countdown ? ` · ${countdown}` : ''}
                                  </div>
                                );
                              })()}

                              {/* Expand/Collapse Chevron */}
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 text-muted-foreground transition-transform",
                                  expandedCards[row.email] && "rotate-180"
                                )}
                              />
                            </div>
                          </div>

                          {/* Expandable Content */}
                          {expandedCards[row.email] && (
                            <>
                              {/* Reasons Bar (show if there are any reasons, regardless of canSend status) */}
                              {reasons.length > 0 && (
                                <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-start gap-2">
                                  <AlertCircle className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                                  <div className="text-[10px] text-amber-400 leading-relaxed">
                                    {reasons.slice(0, 3).join(' • ')}
                                  </div>
                                </div>
                              )}
                              {/* Debug: show if no reasons but also not sending */}
                              {reasons.length === 0 && !canSend && (
                                <div className="px-4 py-1.5 bg-secondary border-b border-border text-[10px] text-muted-foreground">
                                  Status: Paused (no specific reason provided)
                                </div>
                              )}

                              {/* Settings Row - Notion Style */}
                              <div className="px-5 py-4 overflow-x-auto">
                                <div className="flex flex-wrap gap-6 min-w-0">
                                  {/* Cap & Gap - Left Column */}
                                  <div className="flex gap-6 flex-shrink-0">
                                    {/* Cap */}
                                    <div>
                                      <label className="block text-[11px] text-muted-foreground mb-1.5">Daily Cap</label>
                                      <Input
                                        type="number"
                                        className="h-9 w-16 text-sm bg-card border-border text-center hover:border-muted-foreground focus:border-primary"
                                        value={draft.daily_cap}
                                        onChange={(e) => updateDraft(row.email, { daily_cap: parseInt(e.target.value) || 0 })}
                                      />
                                    </div>

                                    {/* Work Days - Notion style */}
                                    <div>
                                      <label className="block text-[11px] text-muted-foreground mb-1.5">Work Days</label>
                                      <div className="flex">
                                        {[
                                          { label: 'M', value: '1', full: 'Mon' },
                                          { label: 'T', value: '2', full: 'Tue' },
                                          { label: 'W', value: '3', full: 'Wed' },
                                          { label: 'T', value: '4', full: 'Thu' },
                                          { label: 'F', value: '5', full: 'Fri' },
                                          { label: 'S', value: '6', full: 'Sat' },
                                          { label: 'S', value: '0', full: 'Sun' },
                                        ].map((day) => {
                                          const workDays: string[] = draft.work_days ?? row.work_days ?? ["1", "2", "3", "4", "5"];
                                          const isActive = workDays.map(String).includes(day.value);
                                          return (
                                            <button
                                              key={day.value}
                                              title={day.full}
                                              onClick={() => {
                                                const newDays = isActive
                                                  ? workDays.filter(d => String(d) !== day.value)
                                                  : [...workDays, day.value];
                                                updateDraft(row.email, { work_days: newDays.map(String) });
                                              }}
                                              className={cn(
                                                "w-6 h-7 text-[10px] font-medium transition-all first:rounded-l last:rounded-r border-r border-white/20 last:border-r-0",
                                                isActive
                                                  ? "bg-primary text-white"
                                                  : "bg-secondary text-muted-foreground hover:bg-secondary"
                                              )}
                                            >
                                              {day.label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    {/* Gap */}
                                    <div>
                                      <div className="flex items-center gap-2 mb-1.5">
                                        <label className="text-[11px] text-muted-foreground">Gap</label>
                                        <button
                                          onClick={() => updateDraft(row.email, { auto_gap: !draft.auto_gap })}
                                          className={cn(
                                            "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                                            draft.auto_gap
                                              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                              : "bg-secondary text-muted-foreground hover:bg-secondary"
                                          )}
                                        >
                                          {draft.auto_gap ? "Auto" : "Manual"}
                                        </button>
                                      </div>
                                      {!draft.auto_gap && (
                                        <div className="flex items-center gap-1.5">
                                          <Input
                                            type="number"
                                            className="h-9 w-14 text-sm bg-card border-border text-center hover:border-muted-foreground"
                                            value={draft.gap_min_sec}
                                            onChange={(e) => updateDraft(row.email, { gap_min_sec: parseInt(e.target.value) || 0 })}
                                          />
                                          <span className="text-muted-foreground">–</span>
                                          <Input
                                            type="number"
                                            className="h-9 w-14 text-sm bg-card border-border text-center hover:border-muted-foreground"
                                            value={draft.gap_max_sec}
                                            onChange={(e) => updateDraft(row.email, { gap_max_sec: parseInt(e.target.value) || 0 })}
                                          />
                                          <span className="text-[11px] text-muted-foreground">sec</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Windows - Right Section */}
                                  <div className="flex-1 min-w-[400px]">
                                    <label className="block text-[11px] text-muted-foreground mb-2">Schedule Windows</label>
                                    <div className="flex flex-wrap gap-3">
                                      {[
                                        { key: 'w1', label: 'Morning' },
                                        { key: 'w2', label: 'Afternoon' },
                                        { key: 'w3', label: 'Evening' }
                                      ].map((win) => {
                                        const start = (draft as any)[`${win.key}_start`];
                                        const end = (draft as any)[`${win.key}_end`];
                                        // DB stores days as string[] like ["1","2","3","4"] where 1=Mon, 2=Tue, etc.
                                        const days: string[] = (draft as any)[`${win.key}_days`] ?? [];
                                        const hasWindow = start && end;
                                        // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun (or 0=Sun depending on db)
                                        const dayConfig = [
                                          { label: 'M', value: '1' },
                                          { label: 'T', value: '2' },
                                          { label: 'W', value: '3' },
                                          { label: 'T', value: '4' },
                                          { label: 'F', value: '5' },
                                          { label: 'S', value: '6' },
                                          { label: 'S', value: '7' },
                                        ];

                                        const toggleDay = (dayValue: string) => {
                                          const isActive = days.some(d => String(d) === dayValue);
                                          const newDays = isActive
                                            ? days.filter(d => String(d) !== dayValue).map(String)
                                            : [...days.map(String), dayValue];
                                          updateDraft(row.email, { [`${win.key}_days`]: newDays });
                                        };

                                        return (
                                          <div
                                            key={win.key}
                                            className={cn(
                                              "min-w-[160px] flex-1 p-3 rounded-lg border transition-all",
                                              hasWindow
                                                ? "bg-card border-border hover:border-muted-foreground shadow-sm"
                                                : "bg-secondary border-border"
                                            )}
                                          >
                                            <div className="text-[11px] font-medium text-muted-foreground mb-2">{win.label}</div>

                                            {/* Time inputs */}
                                            <div className="flex items-center gap-1.5 mb-2.5">
                                              <input
                                                type="time"
                                                className="flex-1 h-8 text-sm bg-card border border-border rounded-md px-2 hover:border-muted-foreground focus:border-primary focus:outline-none"
                                                value={start || ''}
                                                onChange={(e) => updateDraft(row.email, { [`${win.key}_start`]: e.target.value })}
                                              />
                                              <span className="text-muted-foreground">→</span>
                                              <input
                                                type="time"
                                                className="flex-1 h-8 text-sm bg-card border border-border rounded-md px-2 hover:border-muted-foreground focus:border-primary focus:outline-none"
                                                value={end || ''}
                                                onChange={(e) => updateDraft(row.email, { [`${win.key}_end`]: e.target.value })}
                                              />
                                            </div>

                                            {/* Day picker */}
                                            <div className="flex gap-1">
                                              {dayConfig.map((day) => {
                                                const isActive = days.some(d => String(d) === day.value);
                                                return (
                                                  <button
                                                    key={day.value}
                                                    onClick={() => toggleDay(day.value)}
                                                    className={cn(
                                                      "w-7 h-6 rounded text-[10px] font-medium transition-all",
                                                      isActive
                                                        ? "bg-primary text-white"
                                                        : "bg-secondary text-muted-foreground hover:bg-secondary hover:text-muted-foreground"
                                                    )}
                                                  >
                                                    {day.label}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {Array.isArray(accounts) && accounts.length === 0 && !accountsLoading && (
                    <div className="p-8 text-center text-muted-foreground text-xs">No senders configured</div>
                  )}
                </Card>
              </div>
            )}

            {activeView === 'prompts' && <PromptsTab />}
            {activeView === 'demos' && <MarketingDemosTab
              onOpenTestEmail={(data) => {
                setTestEmailData(data);
                setTestEmailOpen(true);
              }}
            />}
            {activeView === 'scraper' && <ScraperControl />}
            {activeView === 'calls' && <CallsManager />}
            {activeView === 'content' && <ContentStudio />}

          </div>
        </div>
      </main>

      {/* Mobile Layout */}
      <div className="md:hidden flex flex-col min-h-screen w-full">
        {/* Mobile Content */}
        <main className="flex-1 overflow-auto pb-16 p-4 pt-6 w-full">
          {mobileTab === 'stats' && <MarketingPipelineStats />}
          {mobileTab === 'senders' && (
            <div className="space-y-4 w-full">
              <h2 className="text-sm font-medium text-foreground">Sender Status</h2>
              <div className="space-y-2">
                {((data as any[]) ?? []).map((row: any) => {
                  const draft = drafts[row.email] || row;
                  return (
                    <Card
                      key={row.email}
                      className="p-3 cursor-pointer active:bg-secondary/50 transition-colors"
                      onClick={() => setSelectedMobileSender(row)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-foreground truncate flex-1 mr-2">{row.email}</span>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={draft.is_active}
                            onCheckedChange={(checked) => {
                              updateDraft(row.email, { is_active: checked });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="scale-75"
                          />
                          <Badge className={cn(
                            "text-[10px] px-2 py-0.5",
                            row.can_send_now && draft.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-secondary text-muted-foreground'
                          )}>
                            {!draft.is_active ? 'Off' : row.can_send_now ? 'Ready' : 'Waiting'}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{row.sent_today}/{row.daily_cap} sent</span>
                        <span>•</span>
                        <span>{row.open_rate_today_pct ?? 0}% open</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded bg-secondary mt-2">
                        <div
                          className="h-full rounded bg-primary"
                          style={{ width: `${Math.min((row.sent_today / row.daily_cap) * 100, 100)}%` }}
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
          {mobileTab === 'calls' && <CallsManager />}
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 h-14 bg-sidebar border-t border-border flex items-center justify-around">
          <button
            onClick={() => setMobileTab('stats')}
            className={cn(
              "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
              mobileTab === 'stats' ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-[10px]">Stats</span>
          </button>
          <button
            onClick={() => setMobileTab('senders')}
            className={cn(
              "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
              mobileTab === 'senders' ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Mail className="h-5 w-5" />
            <span className="text-[10px]">Senders</span>
          </button>
          <button
            onClick={() => setMobileTab('calls')}
            className={cn(
              "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
              mobileTab === 'calls' ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Phone className="h-5 w-5" />
            <span className="text-[10px]">Calls</span>
          </button>
        </nav>
      </div>

      {/* Mobile Sender Bottom Sheet */}
      {selectedMobileSender && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-40 animate-in fade-in duration-200"
            onClick={() => setSelectedMobileSender(null)}
          />
          {/* Sheet */}
          <div className="md:hidden fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom duration-300">
            <div className="bg-card rounded-t-2xl border-t border-border shadow-xl">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Content */}
              <div className="px-5 pb-8 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">{selectedMobileSender.email}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Sender Settings</p>
                  </div>
                  <button
                    onClick={() => setSelectedMobileSender(null)}
                    className="p-2 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-secondary/50 rounded-xl p-3 text-center">
                    <div className="text-lg font-semibold text-foreground">{selectedMobileSender.sent_today}</div>
                    <div className="text-[10px] text-muted-foreground">Sent Today</div>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-3 text-center">
                    <div className="text-lg font-semibold text-foreground">{selectedMobileSender.daily_cap}</div>
                    <div className="text-[10px] text-muted-foreground">Daily Cap</div>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-3 text-center">
                    <div className="text-lg font-semibold text-foreground">{selectedMobileSender.open_rate_today_pct ?? 0}%</div>
                    <div className="text-[10px] text-muted-foreground">Open Rate</div>
                  </div>
                </div>

                {/* Settings */}
                <div className="space-y-4">
                  {/* Active Toggle */}
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl">
                    <div>
                      <div className="text-sm text-foreground">Active</div>
                      <div className="text-[10px] text-muted-foreground">Enable or disable sending</div>
                    </div>
                    <Switch
                      checked={(drafts[selectedMobileSender.email] || selectedMobileSender).is_active}
                      onCheckedChange={(checked) => {
                        updateDraft(selectedMobileSender.email, { is_active: checked });
                      }}
                    />
                  </div>

                  {/* Daily Cap Input */}
                  <div className="p-3 bg-secondary/30 rounded-xl">
                    <div className="text-sm text-foreground mb-2">Daily Limit</div>
                    <Input
                      type="number"
                      value={(drafts[selectedMobileSender.email] || selectedMobileSender).daily_cap}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        updateDraft(selectedMobileSender.email, { daily_cap: parseInt(e.target.value) || 0 });
                      }}
                      className="bg-background border-border h-10"
                    />
                  </div>

                  {/* Work Days */}
                  <div className="p-3 bg-secondary/30 rounded-xl">
                    <div className="text-sm text-foreground mb-2">Work Days</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                        const sender = drafts[selectedMobileSender.email] || selectedMobileSender;
                        const workDays = sender.work_days || [];
                        const isActive = workDays.includes(idx + 1);
                        return (
                          <button
                            key={day}
                            onClick={() => {
                              const newDays = isActive
                                ? workDays.filter((d: number) => d !== idx + 1)
                                : [...workDays, idx + 1];
                              updateDraft(selectedMobileSender.email, { work_days: newDays.sort() });
                            }}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                              isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                            )}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time Windows */}
                  <div className="p-3 bg-secondary/30 rounded-xl space-y-3">
                    <div className="text-sm text-foreground">Time Windows</div>
                    {[1, 2, 3].map((windowNum) => {
                      const sender = drafts[selectedMobileSender.email] || selectedMobileSender;
                      const startKey = `w${windowNum}_start` as keyof typeof sender;
                      const endKey = `w${windowNum}_end` as keyof typeof sender;
                      const start = sender[startKey];
                      const end = sender[endKey];
                      if (!start && !end) return null;
                      return (
                        <div key={windowNum} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-16">Window {windowNum}</span>
                          <div className="flex items-center gap-1.5 flex-1">
                            <Input
                              type="time"
                              value={start || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                updateDraft(selectedMobileSender.email, { [startKey]: e.target.value });
                              }}
                              className="bg-background border-border h-8 text-xs flex-1"
                            />
                            <span className="text-[10px] text-muted-foreground">→</span>
                            <Input
                              type="time"
                              value={end || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                updateDraft(selectedMobileSender.email, { [endKey]: e.target.value });
                              }}
                              className="bg-background border-border h-8 text-xs flex-1"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Save Button */}
                <Button
                  className="w-full h-11"
                  onClick={() => {
                    const draft = drafts[selectedMobileSender.email];
                    if (draft) {
                      updateAccount.mutate(draft);
                    }
                    setSelectedMobileSender(null);
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      <TestEmailDialog
        isOpen={testEmailOpen}
        onClose={() => setTestEmailOpen(false)}
        initialData={testEmailData}
      />
    </div>
  );
};

const PromptsTab = () => {
  const [selectedPrompt, setSelectedPrompt] = useState<any>(null);
  const [testVariables, setTestVariables] = useState<string>(JSON.stringify({
    PROSPECT_NAME: "John",
    LISTING_ADDRESS: "123 Main St, Greenwich",
    LISTING_PRICE: "$2,500,000",
    LANDING_URL: "https://vitrimo.com/property-landing?id=demo",
    EXPERIENCE_SEGMENT: "mid_career",
    LISTING_STATUS: "active",
    CHEAT_SHEET: "Observed 10+ years of high-end experience in Greenwich market."
  }, null, 2));
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [newPromptName, setNewPromptName] = useState('');

  const { data: prompts, isLoading, refetch } = useQuery({
    queryKey: ['prompts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data as unknown) as Prompt[];
    }
  });

  const updatePrompt = useMutation({
    mutationFn: async (payload: { id: string; prompt_text?: string; is_active?: boolean; description?: string }) => {
      const { error } = await supabase
        .from('prompts')
        .update({
          ...payload,
          updated_at: new Date().toISOString()
        })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Success",
        description: "Prompt updated successfully",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to update prompt",
        variant: "destructive",
      });
    }
  });

  const createPrompt = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from('prompts')
        .insert({
          name,
          prompt_text: 'Paste prompt here...',
          description: 'New prompt description',
          is_active: true
        });
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      setIsCreating(false);
      setNewPromptName('');
      toast({
        title: "Success",
        description: "New prompt created",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to create prompt. Name might already exist.",
        variant: "destructive",
      });
    }
  });

  const runTest = async () => {
    console.log('[runTest] Called. selectedPrompt:', selectedPrompt);
    console.log('[runTest] selectedPrompt?.name:', selectedPrompt?.name);
    console.log('[runTest] selectedPrompt?.prompt_text length:', selectedPrompt?.prompt_text?.length);

    if (!selectedPrompt) {
      console.log('[runTest] ERROR: selectedPrompt is null/undefined!');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = {
        prompt_name: selectedPrompt.name,
        prompt_text: selectedPrompt.prompt_text,
        variables: JSON.parse(testVariables)
      };
      console.log('[runTest] Sending payload:', {
        prompt_name: payload.prompt_name,
        prompt_text_length: payload.prompt_text?.length,
        variables: payload.variables
      });

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      console.log('[runTest] Response:', data);
      setTestResult(data);
    } catch (err: any) {
      console.log('[runTest] Error:', err);
      setTestResult({ error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading prompts...</div>;

  const resultData = testResult?.result;
  const isJsonResponse = typeof resultData === 'object' && resultData !== null && !Array.isArray(resultData);

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-3 space-y-4">
        <Button
          variant="outline"
          className="w-full border-dashed border-2 rounded-2xl h-12 text-muted-foreground hover:text-foreground hover:border-muted-foreground"
          onClick={() => setIsCreating(true)}
        >
          + Add New Prompt
        </Button>

        {isCreating && (
          <Card className="rounded-2xl border-rose-100 bg-rose-50/30 p-4 space-y-3 shadow-sm transition-all duration-300">
            <input
              className="w-full bg-card border border-rose-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
              placeholder="prompt_unique_name"
              value={newPromptName}
              onChange={(e) => setNewPromptName(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 bg-rose-600 text-white" onClick={() => createPrompt.mutate(newPromptName)}>Create</Button>
              <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="bg-secondary px-4 py-3 border-b border-border font-semibold text-xs uppercase tracking-wide text-muted-foreground">
            Available Prompts
          </div>
          <div className="divide-y divide-border max-h-[700px] overflow-y-auto">
            {prompts?.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPrompt(p)}
                className={`w-full text-left px-4 py-4 text-sm transition-all hover:bg-secondary group border-l-4 ${selectedPrompt?.id === p.id
                  ? 'bg-rose-50 border-rose-500 text-rose-900 shadow-inner'
                  : 'text-foreground border-transparent'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{p.name}</div>
                  {!p.is_active && <span className="bg-secondary text-muted-foreground text-[8px] uppercase px-1 rounded">Inactive</span>}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tight truncate">{p.description}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
          <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
            <span className="font-bold">TIP:</span> The backend looks for specific names like <code>email_mid_career_active</code>. If you add custom names, ensure they match the logic in the Edge Function.
          </p>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-9 space-y-6">
        {selectedPrompt ? (
          <>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-foreground">{selectedPrompt.name}</h2>
                  <div className="flex items-center gap-2 px-3 py-1 bg-secondary rounded-full border border-border">
                    <span className="text-[10px] font-bold text-muted-foreground">ACTIVE</span>
                    <Switch
                      checked={selectedPrompt.is_active}
                      onCheckedChange={(checked) => {
                        setSelectedPrompt({ ...selectedPrompt, is_active: checked });
                        updatePrompt.mutate({ id: selectedPrompt.id, is_active: checked });
                      }}
                    />
                  </div>
                </div>
                <input
                  className="text-sm text-muted-foreground bg-transparent border-none p-0 focus:ring-0 w-full"
                  value={selectedPrompt.description || ''}
                  onChange={(e) => setSelectedPrompt({ ...selectedPrompt, description: e.target.value })}
                  placeholder="Enter description..."
                />
              </div>
              <Button
                className="bg-primary text-white hover:bg-primary rounded-full px-6"
                onClick={() => updatePrompt.mutate({
                  id: selectedPrompt.id,
                  prompt_text: selectedPrompt.prompt_text,
                  description: selectedPrompt.description
                })}
                disabled={updatePrompt.isPending}
              >
                {updatePrompt.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>

            <textarea
              className="w-full h-[450px] p-6 text-sm font-mono border border-border rounded-3xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/40 outline-none shadow-sm transition-all"
              value={selectedPrompt.prompt_text}
              onChange={(e) => setSelectedPrompt({ ...selectedPrompt, prompt_text: e.target.value })}
              placeholder="Paste your prompt template here..."
            />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card className="rounded-3xl border-border shadow-sm overflow-hidden">
                <CardHeader className="bg-secondary border-b border-border py-4">
                  <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Input Context (JSON)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <textarea
                    className="w-full h-[250px] p-5 text-xs font-mono bg-transparent outline-none border-none resize-none"
                    value={testVariables}
                    onChange={(e) => setTestVariables(e.target.value)}
                  />
                  <div className="p-4 bg-secondary border-t border-border">
                    <Button
                      className="w-full bg-rose-600 text-white hover:bg-rose-700 rounded-full font-semibold h-11"
                      onClick={runTest}
                      disabled={isTesting}
                    >
                      {isTesting ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          AI is thinking...
                        </span>
                      ) : 'Run AI Test Generation'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Live AI Response</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Show Debug Data</span>
                    <Switch checked={showDebug} onCheckedChange={setShowDebug} />
                  </div>
                </div>

                <div className="h-[320px] overflow-auto rounded-3xl bg-card border border-border p-2 shadow-sm">
                  {!testResult && !isTesting && (
                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm italic">
                      Configure variables and hit "Run Test"
                    </div>
                  )}

                  {isTesting && (
                    <div className="flex h-full items-center justify-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
                        <span className="text-xs text-muted-foreground animate-pulse font-medium">Generating using GPT-5.2...</span>
                      </div>
                    </div>
                  )}

                  {testResult && !isTesting && (
                    <div className="space-y-4">
                      {showDebug ? (
                        <div className="p-4 font-mono text-[10px] bg-primary text-emerald-400 rounded-2xl">
                          <pre className="whitespace-pre-wrap">{JSON.stringify(testResult, null, 2)}</pre>
                        </div>
                      ) : (
                        <div className="space-y-4 p-2">
                          {isJsonResponse ? (
                            Object.entries(resultData).map(([key, val]: [string, any]) => (
                              <div key={key} className="rounded-2xl border border-border bg-secondary/50 p-4">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{key}</div>
                                {val?.subject && <div className="text-sm font-semibold text-foreground mb-1">Subject: {val.subject}</div>}
                                <div className="text-sm text-foreground whitespace-pre-wrap">
                                  {typeof val === 'string' ? val : (val?.body || JSON.stringify(val))}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                              {String(resultData)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-[500px] flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-border bg-secondary/30 text-muted-foreground transition-all hover:bg-secondary/50">
            <div className="text-4xl mb-4 text-muted-foreground">✨</div>
            <div className="text-sm font-medium">Select a prompt template to start refining your outreach</div>
          </div>
        )}
      </div>

    </div>
  );
};



const TestEmailDialog = ({ isOpen, onClose, initialData }: { isOpen: boolean, onClose: () => void, initialData?: { subject?: string, body?: string } }) => {
  const { toast } = useToast();
  const [senderEmail, setSenderEmail] = useState<string>("");
  const [recipientEmail, setRecipientEmail] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [isSending, setIsSending] = useState(false);

  // Fetch senders
  const { data: senders } = useQuery({
    queryKey: ['outreach-senders-test'],
    queryFn: async () => {
      const { data, error } = await supabase.from('outreach_sender_accounts').select('email').order('email');
      if (error) throw error;
      return data;
    },
    enabled: isOpen
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData?.subject) setSubject(initialData.subject);
      if (initialData?.body) setBody(initialData.body);
    }
  }, [isOpen, initialData]);

  // Set default sender if available
  useEffect(() => {
    if (senders && senders.length > 0 && !senderEmail) {
      setSenderEmail(senders[0].email);
    }
  }, [senders, senderEmail]);

  const handleSend = async () => {
    if (!senderEmail || !recipientEmail) {
      toast({ title: "Error", description: "Sender and recipient are required", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: {
          sender_email: senderEmail,
          recipient_email: recipientEmail,
          subject: subject,
          body: body
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Email Sent", description: `Test email sent to ${recipientEmail}` });
      onClose();
    } catch (e: any) {
      toast({ title: "Error sending email", description: e.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Test Email</DialogTitle>
          <DialogDescription>Send a test email from any connected account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">From Sender</label>
            <select
              className="w-full p-2 border border-border rounded text-sm bg-card"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
            >
              <option value="">Select Sender...</option>
              {senders?.map((s) => (
                <option key={s.email} value={s.email}>{s.email}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">To Recipient</label>
            <Input
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="recipient@example.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Test Subject"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Body (HTML allowed)</label>
            <textarea
              className="w-full p-2 border border-border rounded text-sm min-h-[100px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="<p>Hello world</p>"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isSending}>Cancel</Button>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? "Sending..." : "Send Test"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AgentDetailsDialog = ({ agentId, isOpen, onClose }: { agentId: string | null, isOpen: boolean, onClose: () => void }) => {
  const { data: agent, isLoading } = useQuery({
    queryKey: ['agent-details', agentId],
    queryFn: async () => {
      if (!agentId) return null;
      const { data, error } = await supabase
        .from('analyzed_agents')
        .select('*')
        .eq('id', agentId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!agentId && isOpen
  });

  if (!isOpen) return null;

  const info = agent?.apify_data ? (typeof agent.apify_data === 'string' ? JSON.parse(agent.apify_data) : agent.apify_data) : {};

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agent Profile</DialogTitle>
          <DialogDescription>Data extracted from Zillow</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading agent data...</div>
        ) : agent ? (
          <div className="space-y-6 pt-2">
            {/* Header with Photo & Basic Info */}
            <div className="flex gap-4 items-start">
              <div className="w-20 h-20 rounded-full bg-secondary overflow-hidden shrink-0 border border-border">
                {info.profilePhotoSrc ? (
                  <img src={info.profilePhotoSrc} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground"><User className="h-8 w-8" /></div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-foreground">{info.name || agent.name}</h3>
                  {agent.processing_status === 'processed' && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Processed</Badge>}
                </div>
                <div className="text-muted-foreground text-sm">{info.title || 'Real Estate Agent'}</div>
                <div className="text-muted-foreground text-sm">{info.businessName}</div>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="bg-secondary">{info.review_count || info.ratings?.count || 0} reviews</Badge>
                  <Badge variant="outline" className="bg-secondary">{info.pastSales?.total || info.recently_sold?.count || 0} sales</Badge>
                  <Badge variant="outline" className="bg-secondary">{info.getToKnowMe?.yearsInIndustry || info.years_experience || '?'} years exp</Badge>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase">Email</div>
                <div className="text-sm flex items-center gap-2">
                  {agent.email || info.email || '—'}
                  {(agent.email_verified || agent.processing_status === 'processed') && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase">Phone</div>
                <div className="text-sm">{info.phone || info.phoneNumbers?.cell || '—'}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase">Brokerage</div>
                <div className="text-sm">{info.brokerageName || info.professional?.businessName || '—'}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase">Location</div>
                <div className="text-sm">{info.city}, {info.state}</div>
              </div>
            </div>

            {/* Bio */}
            {/* Bio */}
            {(info.about || info.aboutMe || info.description || info.personalBio || info.getToKnowMe?.description) && (
              <div className="border-t border-border pt-4">
                <div className="text-xs font-medium text-muted-foreground uppercase mb-1">About</div>
                <div className="text-xs text-muted-foreground leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
                  {info.about || info.aboutMe || info.description || info.personalBio || info.getToKnowMe?.description}
                </div>
              </div>
            )}

            {/* Metrics */}
            <div className="border-t border-border pt-4 grid grid-cols-3 gap-2">
              {info.averageRating && (
                <div className="p-3 bg-secondary rounded">
                  <div className="text-xs text-muted-foreground uppercase">Rating</div>
                  <div className="font-bold text-foreground">{info.averageRating} ★</div>
                </div>
              )}
              {info.forSaleListings?.count !== undefined && (
                <div className="p-3 bg-secondary rounded">
                  <div className="text-xs text-muted-foreground uppercase">Active Listings</div>
                  <div className="font-bold text-foreground">{info.forSaleListings.count}</div>
                </div>
              )}
              {info.soldListings?.count !== undefined && (
                <div className="p-3 bg-secondary rounded">
                  <div className="text-xs text-muted-foreground uppercase">Sold Listings</div>
                  <div className="font-bold text-foreground">{info.soldListings.count}</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">Agent not found</div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const MarketingDemosTab = ({
  onOpenTestEmail
}: {
  onOpenTestEmail: (data: { subject: string, body: string }) => void
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sortField, setSortField] = useState<'created' | 'updated' | 'email1_sent'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: demos, isLoading, error: demosError } = useQuery({
    queryKey: ['marketing-demos-v2', page, pageSize, sortField, sortOrder, segmentFilter],
    queryFn: async () => {
      console.log('[MarketingDemos] Starting query... page:', page, 'pageSize:', pageSize, 'sort:', sortField, sortOrder, 'segment:', segmentFilter);

      const start = page * pageSize;
      const end = start + pageSize - 1;

      // Different query strategy based on sort field
      if (sortField === 'updated' || sortField === 'email1_sent') {
        // When sorting by updated or email sent, query cold_leads first
        let leadsQuery = supabase
          .from('cold_leads')
          .select('*', { count: 'exact' })
          .not('landing_project_id', 'is', null);

        // Apply segment filter at database level
        if (segmentFilter && segmentFilter !== 'all') {
          leadsQuery = leadsQuery.eq('experience_segment', segmentFilter);
        }

        const sortColumn = sortField === 'email1_sent' ? 'email1_sent' : 'updated_at';

        const { data: leads, error: leadsError, count } = await leadsQuery
          .order(sortColumn, { ascending: sortOrder === 'asc', nullsFirst: false })
          .range(start, end);

        if (leadsError) {
          console.error('[MarketingDemos] Leads query error:', leadsError);
          throw leadsError;
        }

        if (!leads?.length) {
          return { items: [], totalCount: count || 0 };
        }

        // Get landing_projects for these leads
        const leadsTyped = leads as any[];
        const projectIds = [...new Set(leadsTyped.map(l => l.landing_project_id).filter(Boolean))];
        const { data: projects, error: projError } = await supabase
          .from('landing_projects')
          .select('*')
          .in('id', projectIds as string[])
          .eq('template_id', 'marketing-outreach');

        if (projError) {
          console.error('[MarketingDemos] Projects query error:', projError);
          throw projError;
        }

        // Create projects map
        const projectsMap = new Map<string, any>();
        (projects || []).forEach((p: any) => projectsMap.set(p.id, p));

        // Build result - merge lead data into project structure
        const result = leadsTyped
          .filter(l => projectsMap.has(l.landing_project_id))
          .map(lead => {
            const project = projectsMap.get(lead.landing_project_id);
            return {
              ...project,
              cold_leads: [lead]
            };
          });

        console.log('[MarketingDemos] Loaded', result.length, `records by ${sortColumn}, total:`, count);
        return { items: result, totalCount: count || 0 };
      }

      // Default: sort by landing_projects.created_at
      // When filtering by segment, we need to query cold_leads first to get matching project IDs
      if (segmentFilter && segmentFilter !== 'all') {
        // First get all marketing-outreach project IDs
        const { data: marketingProjects } = await supabase
          .from('landing_projects')
          .select('id')
          .eq('template_id', 'marketing-outreach');

        const marketingProjectIds = (marketingProjects || []).map((p: any) => p.id);

        if (!marketingProjectIds.length) {
          return { items: [], totalCount: 0 };
        }

        // Get leads with this segment that belong to marketing-outreach projects
        const { data: segmentLeads, error: segLeadsError, count: segCount } = await supabase
          .from('cold_leads')
          .select('landing_project_id', { count: 'exact' })
          .in('landing_project_id', marketingProjectIds)
          .eq('experience_segment', segmentFilter);

        if (segLeadsError) throw segLeadsError;

        const segmentProjectIds = [...new Set((segmentLeads || []).map((l: any) => l.landing_project_id).filter(Boolean))];

        if (!segmentProjectIds.length) {
          return { items: [], totalCount: 0 };
        }

        // Now query landing_projects with pagination
        const { data: projects, error: projError } = await supabase
          .from('landing_projects')
          .select('*')
          .eq('template_id', 'marketing-outreach')
          .in('id', segmentProjectIds as string[])
          .order('created_at', { ascending: sortOrder === 'asc' })
          .range(start, end);

        if (projError) throw projError;

        if (!projects?.length) {
          return { items: [], totalCount: segCount || 0 };
        }

        // Get cold_leads for these projects
        const projectIds = projects.map((p: any) => p.id);
        const { data: leads } = await supabase
          .from('cold_leads')
          .select('*')
          .in('landing_project_id', projectIds);

        const leadsMap = new Map<string, any[]>();
        (leads || []).forEach((lead: any) => {
          const arr = leadsMap.get(lead.landing_project_id) || [];
          arr.push(lead);
          leadsMap.set(lead.landing_project_id, arr);
        });

        const result = projects.map((p: any) => ({
          ...p,
          cold_leads: leadsMap.get(p.id) || []
        }));

        return { items: result, totalCount: segCount || 0 };
      }

      // No segment filter - query all landing_projects
      const { data: projects, error: projError, count } = await supabase
        .from('landing_projects')
        .select('*', { count: 'exact' })
        .eq('template_id', 'marketing-outreach')
        .order('created_at', { ascending: sortOrder === 'asc' })
        .range(start, end);

      if (projError) {
        console.error('[MarketingDemos] Projects query error:', projError);
        throw projError;
      }

      if (!projects?.length) {
        return { items: [], totalCount: count || 0 };
      }

      // Get cold_leads for these projects
      const projectIds = projects.map((p: any) => p.id);
      const { data: leads, error: leadsError } = await supabase
        .from('cold_leads')
        .select('*')
        .in('landing_project_id', projectIds);

      if (leadsError) {
        console.error('[MarketingDemos] Leads query error:', leadsError);
      }

      // Merge leads into projects
      const leadsMap = new Map<string, any[]>();
      (leads || []).forEach((lead: any) => {
        const arr = leadsMap.get(lead.landing_project_id) || [];
        arr.push(lead);
        leadsMap.set(lead.landing_project_id, arr);
      });

      const result = projects.map((p: any) => ({
        ...p,
        cold_leads: leadsMap.get(p.id) || []
      }));

      console.log('[MarketingDemos] Loaded', result.length, 'records, total:', count);
      return { items: result, totalCount: count || 0 };
    },
    retry: 1,
    staleTime: 30000
  });

  // Log loading state
  if (demosError) {
    console.error('[MarketingDemos] Error state:', demosError);
  }

  const deleteMutation = useMutation({
    mutationFn: async ({ projectId, leadId }: { projectId: string; leadId?: string }) => {
      // Delete cold_lead first (if exists) due to foreign key
      if (leadId) {
        const { error: leadError } = await supabase
          .from('cold_leads')
          .delete()
          .eq('id', leadId);
        if (leadError) throw leadError;
      }
      // Delete landing_project
      const { error: projectError } = await supabase
        .from('landing_projects')
        .delete()
        .eq('id', projectId);
      if (projectError) throw projectError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-demos-v2'] });
      toast({ title: 'Deleted', description: 'Demo and lead removed.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const regenerateMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const { data, error } = await supabase.functions.invoke('regenerate-emails', {
        body: { lead_ids: [leadId] }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['marketing-demos-v2'] });
      toast({
        title: 'Regenerated',
        description: `Emails regenerated using: ${data?.results?.[0]?.prompt || 'prompt'}`
      });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (items: Array<{ projectId: string; leadId?: string }>) => {
      for (const item of items) {
        if (item.leadId) {
          const { error: leadError } = await supabase
            .from('cold_leads')
            .delete()
            .eq('id', item.leadId);
          if (leadError) throw leadError;
        }
        const { error: projectError } = await supabase
          .from('landing_projects')
          .delete()
          .eq('id', item.projectId);
        if (projectError) throw projectError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-demos-v2'] });
      setSelectedRows(new Set());
      toast({ title: 'Deleted', description: `${selectedRows.size} items removed.` });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  // Bulk regenerate mutation
  const bulkRegenerateMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { data, error } = await supabase.functions.invoke('regenerate-emails', {
        body: { lead_ids: leadIds }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['marketing-demos-v2'] });
      setSelectedRows(new Set());
      toast({
        title: 'Regenerated',
        description: `Regenerated emails for ${data?.results?.length || 0} leads.`
      });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const filteredData = useMemo(() => {
    let items = demos?.items || [];

    // Filter by segment
    if (segmentFilter && segmentFilter !== 'all') {
      items = items.filter((lp: any) => {
        const lead = lp.cold_leads?.[0];
        return lead?.experience_segment === segmentFilter;
      });
    }

    // Filter by search term
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      items = items.filter((lp: any) =>
        lp.agent_name?.toLowerCase().includes(lowerSearch) ||
        lp.agent_email?.toLowerCase().includes(lowerSearch) ||
        lp.addr_line1?.toLowerCase().includes(lowerSearch)
      );
    }
    // Sort by updated or created
    items = [...items].sort((a, b) => {
      const leadA = a.cold_leads?.[0];
      const leadB = b.cold_leads?.[0];
      const dateA = sortField === 'updated'
        ? new Date(leadA?.updated_at || a.created_at || 0).getTime()
        : new Date(a.created_at || 0).getTime();
      const dateB = sortField === 'updated'
        ? new Date(leadB?.updated_at || b.created_at || 0).getTime()
        : new Date(b.created_at || 0).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    return items;
  }, [demos?.items, searchTerm, segmentFilter, sortField, sortOrder]);

  const totalCount = demos?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getEmailStatus = (lead: any, emailNum: number) => {
    const bodyKey = `email${emailNum}_body`;
    const sentKey = `email${emailNum}_sent`;

    // No email content yet
    if (!lead[bodyKey]) return null;

    // Check if failed
    if (lead.processing_status === 'failed') return 'failed';

    // Check actual sent timestamp from database
    if (lead[sentKey]) return 'sent';

    // Has content but not sent yet
    return 'pending';
  };

  const StatusBadgeEmail = ({ status }: { status: string | null }) => {
    if (!status) return <span className="text-xs text-muted-foreground">—</span>;
    const styles: Record<string, string> = {
      sent: 'bg-blue-500/15 text-blue-400',
      opened: 'bg-emerald-500/15 text-emerald-400',
      unopened: 'bg-secondary text-muted-foreground',
      spam: 'bg-red-500/15 text-red-400',
      pending: 'bg-amber-500/15 text-amber-400',
      failed: 'bg-red-500/15 text-red-400'
    };
    const labels: Record<string, string> = {
      sent: 'Sent',
      opened: 'Opened',
      unopened: 'Unopened',
      spam: 'Spam',
      pending: 'Pending',
      failed: 'Failed'
    };
    return <span className={cn('inline-block text-[9px] px-1.5 py-0.5 rounded font-medium', styles[status])}>{labels[status]}</span>;
  };

  const SegmentBadge = ({ segment }: { segment: string | null }) => {
    if (!segment) return null;
    const styles: Record<string, string> = {
      early_career: 'bg-blue-500/15 text-blue-400',
      mid_career: 'bg-violet-500/15 text-violet-400',
      senior: 'bg-orange-500/15 text-orange-400',
      dinosaur: 'bg-emerald-500/15 text-emerald-400'
    };
    const labels: Record<string, string> = {
      early_career: 'Early Career',
      mid_career: 'Mid Career',
      senior: 'Senior Agent',
      dinosaur: 'Top Producer'
    };
    return (
      <span className={cn('inline-block text-[9px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap', styles[segment] || 'bg-secondary text-muted-foreground')}>
        {labels[segment] || segment.replace('_', ' ')}
      </span>
    );
  };

  if (isLoading) return <div className="p-6 text-center text-muted-foreground text-xs">Loading...</div>;

  return (
    <div className="space-y-3">
      <AgentDetailsDialog agentId={selectedAgentId} isOpen={isAgentDialogOpen} onClose={() => setIsAgentDialogOpen(false)} />

      {/* Header with filters - Notion style */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{filteredData.length} leads</span>
        </div>

        {/* Segment filter pills */}
        <div className="flex items-center gap-1 bg-secondary p-0.5 rounded-md">
          {[
            { value: 'all', label: 'All' },
            { value: 'early_career', label: 'Early' },
            { value: 'mid_career', label: 'Mid' },
            { value: 'senior', label: 'Senior' },
            { value: 'dinosaur', label: 'Top' }
          ].map(seg => (
            <button
              key={seg.value}
              onClick={() => { setSegmentFilter(seg.value); setPage(0); }}
              className={cn(
                'px-2 py-1 text-[10px] font-medium rounded transition-colors',
                segmentFilter === seg.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {seg.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-48">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="pl-7 h-7 text-xs rounded-md border-border bg-secondary focus:bg-secondary"
            value={searchTerm}
            onChange={(e: any) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Notion-style table */}
      <div className="border border-border rounded-md overflow-hidden bg-card">
        {/* Bulk Action Bar */}
        {selectedRows.size > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-rose-50 border-b border-rose-100">
            <span className="text-xs font-medium text-rose-700">
              {selectedRows.size} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-rose-200 text-rose-700 hover:bg-rose-100"
                onClick={() => {
                  const items = filteredData
                    .filter((lp: any) => selectedRows.has(lp.id))
                    .map((lp: any) => ({ projectId: lp.id, leadId: (lp.cold_leads?.[0] as any)?.id }));
                  const leadIds = items.map((i: any) => i.leadId).filter(Boolean) as string[];
                  if (leadIds.length > 0) {
                    bulkRegenerateMutation.mutate(leadIds);
                  }
                }}
                disabled={bulkRegenerateMutation.isPending}
              >
                <RefreshCw className={cn("h-3 w-3 mr-1", bulkRegenerateMutation.isPending && "animate-spin")} />
                Regenerate
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-100"
                onClick={() => {
                  if (confirm(`Delete ${selectedRows.size} selected items?`)) {
                    const items = filteredData
                      .filter((lp: any) => selectedRows.has(lp.id))
                      .map((lp: any) => ({ projectId: lp.id, leadId: (lp.cold_leads?.[0] as any)?.id }));
                    bulkDeleteMutation.mutate(items);
                  }
                }}
                disabled={bulkDeleteMutation.isPending}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => setSelectedRows(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-medium text-muted-foreground bg-secondary/50 border-b border-border">
          <div className="col-span-1 flex items-center">
            <input
              type="checkbox"
              className="h-3 w-3 rounded border-border text-rose-600 focus:ring-rose-500"
              checked={filteredData.length > 0 && filteredData.every((lp: any) => selectedRows.has(lp.id))}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedRows(new Set(filteredData.map((lp: any) => lp.id)));
                } else {
                  setSelectedRows(new Set());
                }
              }}
            />
          </div>
          <div className="col-span-2">Property</div>
          <div className="col-span-2">Agent</div>
          <div
            className="col-span-1 cursor-pointer hover:text-foreground flex items-center gap-0.5"
            onClick={() => {
              if (sortField === 'created') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
              else { setSortField('created'); setSortOrder('desc'); }
            }}
          >
            Created {sortField === 'created' && (sortOrder === 'desc' ? '↓' : '↑')}
          </div>
          <div
            className="col-span-1 cursor-pointer hover:text-foreground flex items-center gap-0.5"
            onClick={() => {
              if (sortField === 'updated') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
              else { setSortField('updated'); setSortOrder('desc'); }
            }}
          >
            Updated {sortField === 'updated' && (sortOrder === 'desc' ? '↓' : '↑')}
          </div>
          <div className="col-span-1 text-center cursor-pointer hover:text-foreground select-none"
            onClick={() => {
              if (sortField === 'email1_sent') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
              else { setSortField('email1_sent'); setSortOrder('desc'); }
            }}>
            E1 {sortField === 'email1_sent' && (sortOrder === 'desc' ? '↓' : '↑')}
          </div>
          <div className="col-span-1 text-center">E2</div>
          <div className="col-span-1 text-center">E3</div>
          <div className="col-span-2"></div>
        </div>

        {/* Rows */}
        <div>
          {filteredData.map((lp: any) => {
            const lead = (lp.cold_leads?.[0] || {}) as any;
            const isExpanded = expandedRows.has(lp.id);
            const displayName = lead.name || lp.agent_name || '—';
            const displayEmail = lead.email || lp.agent_email || '—';

            return (
              <div key={lp.id} className="border-b border-border last:border-0">
                <div
                  className="grid grid-cols-12 gap-2 px-3 py-2.5 text-xs hover:bg-secondary/50 cursor-pointer transition-colors"
                  onClick={() => lead.id && toggleRow(lp.id)}
                >
                  <div className="col-span-1 flex items-center gap-1">
                    <input
                      type="checkbox"
                      className="h-3 w-3 rounded border-border text-primary focus:ring-primary"
                      checked={selectedRows.has(lp.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        setSelectedRows(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(lp.id);
                          else next.delete(lp.id);
                          return next;
                        });
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRow(lp.id);
                      }}
                      className="p-1 rounded hover:bg-secondary transition-colors"
                      title={isExpanded ? "Collapse" : "View emails"}
                    >
                      <ChevronRight className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isExpanded && "rotate-90"
                      )} />
                    </button>
                  </div>
                  <div className="col-span-2 flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground truncate text-[11px]">{lp.addr_line1 || 'No address'}</span>
                      {(lp.property_status === 'Sold' || lp.payload?.listing_status === 'sold') && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 font-medium">SOLD</span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">${lp.asking_price?.toLocaleString() || '—'}</span>
                  </div>
                  <div className="col-span-2 flex flex-col gap-0.5 min-w-0">
                    <span
                      className="text-foreground truncate text-[11px] font-medium cursor-pointer hover:underline hover:text-muted-foreground transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Type casting payload to any to access agent_id safely
                        const payload = lp.payload as any;
                        if (payload?.agent_id) {
                          setSelectedAgentId(payload.agent_id);
                          setIsAgentDialogOpen(true);
                        }
                      }}
                    >
                      {displayName}
                    </span>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-[10px] text-muted-foreground truncate">{displayEmail}</span>
                      {(lead.zerobounce || lead.valid) && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      )}
                    </div>
                    <SegmentBadge segment={lead.experience_segment} />
                  </div>
                  <div className="col-span-1 flex flex-col justify-center text-[10px] text-muted-foreground">
                    {lp.created_at ? (
                      <>
                        <span>{new Date(lp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        <span className="text-[9px] text-muted-foreground">{new Date(lp.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                      </>
                    ) : '—'}
                  </div>
                  <div className="col-span-1 flex flex-col justify-center text-[10px] text-muted-foreground">
                    {lead.updated_at ? (
                      <>
                        <span>{new Date(lead.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        <span className="text-[9px] text-muted-foreground">{new Date(lead.updated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                      </>
                    ) : '—'}
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    <StatusBadgeEmail status={getEmailStatus(lead, 1)} />
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    <StatusBadgeEmail status={getEmailStatus(lead, 2)} />
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    <StatusBadgeEmail status={getEmailStatus(lead, 3)} />
                  </div>
                  <div className="col-span-2 flex items-center gap-3">
                    <a
                      href={`/property-landing?id=${lp?.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        regenerateMutation.mutate(lead.id);
                      }}
                      className={cn(
                        "text-muted-foreground hover:text-blue-600",
                        regenerateMutation.isPending && "animate-spin"
                      )}
                      disabled={regenerateMutation.isPending}
                      title="Regenerate emails"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this demo and lead?')) {
                          deleteMutation.mutate({ projectId: lp.id, leadId: lead.id });
                        }
                      }}
                      className="text-muted-foreground hover:text-red-600"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {isExpanded && lead.id && (
                  <div className="px-4 pb-4 bg-secondary border-t border-border">
                    <div className="grid grid-cols-3 gap-4 pt-3">
                      {[1, 2, 3].map(num => {
                        const subjectKey = `email${num}_subject`;
                        const bodyKey = `email${num}_body`;
                        const subject = lead[subjectKey];
                        const body = lead[bodyKey];
                        const status = getEmailStatus(lead, num);

                        return (
                          <div key={num} className="border border-border rounded p-3 bg-card space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground uppercase">Email {num}</span>
                              <StatusBadgeEmail status={status} />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-2 text-[10px] text-muted-foreground hover:text-muted-foreground"
                                onClick={() => {
                                  onOpenTestEmail({ subject: subject || "", body: body || "" });
                                }}
                              >
                                Test Send
                              </Button>
                            </div>
                            {subject && (
                              <div className="text-xs text-foreground truncate">
                                <span className="text-muted-foreground">Subject:</span> {subject}
                              </div>
                            )}
                            {body ? (
                              <ScrollArea className="h-24">
                                <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{body}</p>
                              </ScrollArea>
                            ) : (
                              <p className="text-[10px] text-muted-foreground italic">No content</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredData.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-xs">No demos found</div>
        )}

        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="border border-border rounded px-2 py-1 text-xs bg-card"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
            <span className="ml-2">Total: <strong>{totalCount}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              ← Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              Next →
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default OutreachDashboard;
