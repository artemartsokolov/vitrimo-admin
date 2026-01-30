import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
    Sparkles,
    RefreshCw,
    TrendingUp,
    Instagram,
    Heart,
    ExternalLink,
    Loader2,
    Check,
    Copy,
    Video,
    Clock,
    Zap,
    FileText,
    Star
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// Types
interface ContentTrend {
    id: string;
    source: string;
    source_url: string;
    content_type: string;
    caption: string;
    thumbnail_url: string;
    engagement_score: number;
    hashtags: string[];
    status: string;
    scraped_at: string;
}

interface VideoScript {
    id: string;
    trend_id: string;
    style: string;
    hook: string;
    script_text: string;
    duration_seconds: number;
    score: number;
    status: string;
}

// Trend Card
const TrendCard = ({
    trend,
    scriptsCount,
    bestScore,
    isSelected,
    onSelect
}: {
    trend: ContentTrend;
    scriptsCount: number;
    bestScore: number;
    isSelected: boolean;
    onSelect: () => void;
}) => (
    <div
        className={cn(
            "p-3 rounded-lg border cursor-pointer transition-all",
            isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-secondary/30"
        )}
        onClick={onSelect}
    >
        <div className="flex gap-3">
            <div className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0 bg-secondary">
                {trend.thumbnail_url && (
                    <img src={trend.thumbnail_url} alt="" className="w-full h-full object-cover" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[9px] px-1.5 h-4 bg-secondary/50">
                        {trend.source}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Heart className="h-2.5 w-2.5" />
                        {(trend.engagement_score / 1000).toFixed(0)}K
                    </span>
                </div>
                <p className="text-xs text-foreground line-clamp-2 mb-1.5">{trend.caption}</p>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] h-4 bg-primary/10 text-primary border-primary/30">
                        <FileText className="h-2.5 w-2.5 mr-1" />
                        {scriptsCount} scripts
                    </Badge>
                    {bestScore > 0 && (
                        <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                            <Star className="h-2.5 w-2.5 text-amber-400" />
                            {bestScore}%
                        </span>
                    )}
                </div>
            </div>
        </div>
    </div>
);

// Script Card
const ScriptCard = ({
    script,
    isSelected,
    onSelect,
    onApprove,
    onCopy
}: {
    script: VideoScript;
    isSelected: boolean;
    onSelect: () => void;
    onApprove: () => void;
    onCopy: () => void;
}) => {
    const styleEmoji: Record<string, string> = { funny: '😂', educational: '📚', storytelling: '📖', testimonial: '⭐' };

    return (
        <div
            className={cn(
                "p-3 rounded-lg border transition-all cursor-pointer",
                isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-secondary/30"
            )}
            onClick={onSelect}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span>{styleEmoji[script.style] || '📝'}</span>
                    <Badge variant="outline" className="text-[9px] h-4 capitalize">{script.style}</Badge>
                    <Badge variant="outline" className="text-[9px] h-4">{script.duration_seconds}s</Badge>
                </div>
                <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                    <span className="text-xs font-medium">{script.score}%</span>
                </div>
            </div>
            <div className="bg-amber-500/10 rounded px-2.5 py-2 mb-3">
                <div className="text-[9px] text-amber-500 font-medium uppercase mb-0.5 flex items-center gap-1">
                    <Zap className="h-2.5 w-2.5" />Hook
                </div>
                <p className="text-sm text-foreground">"{script.hook}"</p>
            </div>
            <div className="text-[11px] text-muted-foreground line-clamp-3 mb-3 whitespace-pre-line">
                {script.script_text.split('\n').slice(3, 6).join('\n')}
            </div>
            <div className="flex gap-2">
                <Button
                    size="sm"
                    className={cn("h-7 text-xs flex-1", script.status === 'approved' ? "bg-emerald-600/20 text-emerald-400" : "bg-emerald-600 hover:bg-emerald-700")}
                    onClick={(e) => { e.stopPropagation(); onApprove(); }}
                >
                    <Check className="h-3 w-3 mr-1" />
                    {script.status === 'approved' ? 'Approved' : 'Approve'}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onCopy(); }}>
                    <Copy className="h-3 w-3" />
                </Button>
            </div>
        </div>
    );
};

// Instagram Widget
const InstagramWidget = () => {
    const [username, setUsername] = useState('');
    const queryClient = useQueryClient();

    const syncMutation = useMutation({
        mutationFn: async (username: string) => {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase.functions.invoke('sync-instagram', {
                body: { username, user_id: user?.id }
            });
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            toast({ title: 'Connected!', description: `@${data.profile.username} synced` });
            queryClient.invalidateQueries({ queryKey: ['instagram-account'] });
        },
        onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });

    const { data: account } = useQuery({
        queryKey: ['instagram-account'],
        queryFn: async () => {
            const { data } = await supabase.from('instagram_accounts').select('*, instagram_metrics(*)').order('created_at', { ascending: false }).limit(1).single();
            return data;
        }
    });

    return (
        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 rounded-lg border border-purple-500/20">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                <Instagram className="h-4 w-4 text-white" />
            </div>
            {account ? (
                <>
                    <div className="flex-1">
                        <span className="text-sm font-medium">@{account.username}</span>
                        <span className="text-xs text-muted-foreground ml-2">{((account.instagram_metrics?.[0]?.followers || 0) / 1000).toFixed(1)}K</span>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => syncMutation.mutate(account.username)}>
                        {syncMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    </Button>
                </>
            ) : (
                <>
                    <div className="flex-1"><span className="text-sm font-medium">Track Growth</span></div>
                    <Input placeholder="@username" className="h-7 w-28 text-xs" value={username} onChange={(e) => setUsername(e.target.value)} />
                    <Button size="sm" className="h-7" onClick={() => syncMutation.mutate(username)} disabled={syncMutation.isPending || !username}>
                        {syncMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Connect'}
                    </Button>
                </>
            )}
        </div>
    );
};

// Main Component
export const ContentStudio = () => {
    const [selectedTrendId, setSelectedTrendId] = useState<string | null>(null);
    const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
    const queryClient = useQueryClient();

    // Fetch trends
    const { data: trends = [], isLoading: trendsLoading } = useQuery({
        queryKey: ['content-trends'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('content_trends')
                .select('*')
                .order('engagement_score', { ascending: false })
                .limit(20);
            if (error) throw error;
            return data as ContentTrend[];
        },
        refetchInterval: 30000
    });

    // Fetch scripts for selected trend
    const { data: scripts = [] } = useQuery({
        queryKey: ['video-scripts', selectedTrendId],
        queryFn: async () => {
            if (!selectedTrendId) return [];
            const { data, error } = await supabase
                .from('video_scripts')
                .select('*')
                .eq('trend_id', selectedTrendId)
                .order('score', { ascending: false });
            if (error) throw error;
            return data as VideoScript[];
        },
        enabled: !!selectedTrendId
    });

    // Fetch all scripts count per trend
    const { data: scriptCounts = {} } = useQuery({
        queryKey: ['script-counts'],
        queryFn: async () => {
            const { data } = await supabase.from('video_scripts').select('trend_id, score');
            const counts: Record<string, { count: number; best: number }> = {};
            data?.forEach((s) => {
                if (!counts[s.trend_id]) counts[s.trend_id] = { count: 0, best: 0 };
                counts[s.trend_id].count++;
                counts[s.trend_id].best = Math.max(counts[s.trend_id].best, s.score || 0);
            });
            return counts;
        }
    });

    // Refresh trends mutation
    const refreshMutation = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase.functions.invoke('scrape-trends');
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            toast({ title: 'Trends refreshed!', description: `${data.inserted} new, ${data.generating_scripts} generating scripts` });
            queryClient.invalidateQueries({ queryKey: ['content-trends'] });
        },
        onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });

    // Approve script mutation
    const approveMutation = useMutation({
        mutationFn: async (scriptId: string) => {
            const { error } = await supabase
                .from('video_scripts')
                .update({ status: 'approved', approved_at: new Date().toISOString() })
                .eq('id', scriptId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Script approved! ✅' });
            queryClient.invalidateQueries({ queryKey: ['video-scripts'] });
        }
    });

    // Auto-select first trend
    useEffect(() => {
        if (trends.length > 0 && !selectedTrendId) {
            setSelectedTrendId(trends[0].id);
        }
    }, [trends, selectedTrendId]);

    const totalScripts = Object.values(scriptCounts).reduce((acc, v) => acc + v.count, 0);

    return (
        <div className="space-y-4 p-1">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Video className="h-5 w-5 text-primary" />
                        Content Studio
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        {trends.length} trends • {totalScripts} auto-generated scripts
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
                    {refreshMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Refresh
                </Button>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: Trends */}
                <Card>
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Trending Content
                            <Badge variant="outline" className="ml-auto text-[9px]">
                                <Clock className="h-2.5 w-2.5 mr-1" />
                                Live
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[500px]">
                            <div className="p-3 space-y-2">
                                {trendsLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : trends.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground text-sm">
                                        <p>No trends yet</p>
                                        <Button size="sm" className="mt-2" onClick={() => refreshMutation.mutate()}>
                                            Fetch Trends
                                        </Button>
                                    </div>
                                ) : (
                                    trends.map((trend) => (
                                        <TrendCard
                                            key={trend.id}
                                            trend={trend}
                                            scriptsCount={scriptCounts[trend.id]?.count || 0}
                                            bestScore={scriptCounts[trend.id]?.best || 0}
                                            isSelected={selectedTrendId === trend.id}
                                            onSelect={() => { setSelectedTrendId(trend.id); setSelectedScriptId(null); }}
                                        />
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Right: Scripts */}
                <Card>
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            Generated Scripts
                            {scripts.length > 0 && (
                                <Badge variant="outline" className="ml-2 text-[9px]">{scripts.length} options</Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[500px]">
                            <div className="p-3 space-y-3">
                                {!selectedTrendId ? (
                                    <div className="text-center py-12 text-muted-foreground text-sm">Select a trend</div>
                                ) : scripts.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground text-sm">
                                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                                        Generating scripts...
                                    </div>
                                ) : (
                                    scripts.map((script) => (
                                        <ScriptCard
                                            key={script.id}
                                            script={script}
                                            isSelected={selectedScriptId === script.id}
                                            onSelect={() => setSelectedScriptId(script.id)}
                                            onApprove={() => approveMutation.mutate(script.id)}
                                            onCopy={() => { navigator.clipboard.writeText(script.script_text); toast({ title: 'Copied!' }); }}
                                        />
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* Instagram */}
            <InstagramWidget />
        </div>
    );
};

export default ContentStudio;
