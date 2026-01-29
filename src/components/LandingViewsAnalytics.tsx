import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, ExternalLink, Monitor, Smartphone, Tablet } from "lucide-react";

type LandingViewRecord = {
    landing_id: string;
    agent_name: string;
    agent_email: string;
    agent_phone: string;
    property_address: string;
    property_price: number | null;
    property_type: string;
    total_views: number;
    unique_visitors: number;
    mobile_percent: number;
    desktop_percent: number;
    tablet_percent: number;
    last_viewed_at: string;
    landing_url: string;
};

const PAGE_SIZE = 50;

type SortBy = 'views' | 'lastViewed';

export const LandingViewsAnalytics = () => {
    const [page, setPage] = useState(0);
    const [sortBy, setSortBy] = useState<SortBy>('lastViewed');

    const { data, isLoading, isError } = useQuery<{ items: LandingViewRecord[]; totalCount: number }>({
        queryKey: ['landing-views-analytics', page, sortBy],
        queryFn: async () => {
            try {
                // Get page_view_events
                const { data: viewsData, error: viewsError } = await (supabase as any)
                    .from('page_view_events')
                    .select('landing_id, visitor_id, user_agent, viewed_at');

                if (viewsError) {
                    console.error('Views query error:', viewsError);
                    throw viewsError;
                }

                // Group by landing_id
                const landingStats: Record<string, {
                    total: number;
                    visitors: Set<string>;
                    mobile: number;
                    desktop: number;
                    tablet: number;
                    lastViewed: string;
                }> = {};

                (viewsData || []).forEach((pv: any) => {
                    if (!pv.landing_id) return;

                    if (!landingStats[pv.landing_id]) {
                        landingStats[pv.landing_id] = {
                            total: 0,
                            visitors: new Set(),
                            mobile: 0,
                            desktop: 0,
                            tablet: 0,
                            lastViewed: pv.viewed_at
                        };
                    }

                    const stats = landingStats[pv.landing_id];
                    stats.total++;

                    if (pv.visitor_id) {
                        stats.visitors.add(pv.visitor_id);
                    }

                    // Device detection
                    const ua = (pv.user_agent || '').toLowerCase();
                    if (/ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) {
                        stats.tablet++;
                    } else if (/mobile|iphone|ipod|android.*mobile|blackberry|opera mini|iemobile/i.test(ua)) {
                        stats.mobile++;
                    } else {
                        stats.desktop++;
                    }

                    if (pv.viewed_at > stats.lastViewed) {
                        stats.lastViewed = pv.viewed_at;
                    }
                });

                // Sort landing_ids by selected sort option
                const landingIdsWithViews = Object.entries(landingStats)
                    .sort((a, b) => {
                        if (sortBy === 'lastViewed') {
                            return new Date(b[1].lastViewed).getTime() - new Date(a[1].lastViewed).getTime();
                        }
                        return b[1].total - a[1].total;
                    })
                    .map(([id]) => id);

                const totalCount = landingIdsWithViews.length;

                if (totalCount === 0) {
                    return { items: [], totalCount: 0 };
                }

                // Paginate
                const start = page * PAGE_SIZE;
                const paginatedIds = landingIdsWithViews.slice(start, start + PAGE_SIZE);

                if (paginatedIds.length === 0) {
                    return { items: [], totalCount };
                }

                // Fetch landing_projects with all property/agent data
                const { data: projects, error: projError } = await supabase
                    .from('landing_projects')
                    .select('id, agent_name, agent_email, agent_phone, addr_line1, addr_city, addr_province, asking_price, property_type, landing_url')
                    .in('id', paginatedIds);

                if (projError) {
                    console.error('Projects query error:', projError);
                    throw projError;
                }

                // Map projects
                const projectMap = new Map<string, any>();
                (projects || []).forEach((p: any) => projectMap.set(p.id, p));

                // Build result
                const items: LandingViewRecord[] = paginatedIds.map(landingId => {
                    const stats = landingStats[landingId];
                    const project = projectMap.get(landingId);

                    const total = stats.total;
                    const mobilePercent = total > 0 ? Math.round((stats.mobile / total) * 100) : 0;
                    const desktopPercent = total > 0 ? Math.round((stats.desktop / total) * 100) : 0;
                    const tabletPercent = total > 0 ? Math.round((stats.tablet / total) * 100) : 0;

                    // Build address from parts
                    const addressParts = [
                        project?.addr_line1,
                        project?.addr_city,
                        project?.addr_province
                    ].filter(Boolean);
                    const address = addressParts.length > 0 ? addressParts.join(', ') : 'No Address';

                    return {
                        landing_id: landingId,
                        agent_name: project?.agent_name || 'Unknown Agent',
                        agent_email: project?.agent_email || '',
                        agent_phone: project?.agent_phone || '',
                        property_address: address,
                        property_price: project?.asking_price || null,
                        property_type: project?.property_type || 'Unknown',
                        total_views: stats.total,
                        unique_visitors: stats.visitors.size,
                        mobile_percent: mobilePercent,
                        desktop_percent: desktopPercent,
                        tablet_percent: tabletPercent,
                        last_viewed_at: stats.lastViewed,
                        landing_url: project?.landing_url || ''
                    };
                });

                return { items, totalCount };
            } catch (err) {
                console.error('LandingViewsAnalytics query error:', err);
                return { items: [], totalCount: 0 };
            }
        },
        refetchInterval: 60000,
        staleTime: 30000
    });

    const totalPages = Math.ceil((data?.totalCount || 0) / PAGE_SIZE);

    const formatPrice = (price: number | null) => {
        if (!price) return '—';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(price);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    if (isLoading) {
        return (
            <Card className="rounded-lg border border-border">
                <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium">Landing Page Views Analytics</CardTitle>
                </CardHeader>
                <CardContent className="py-8 text-center text-muted-foreground text-xs">
                    Loading analytics data...
                </CardContent>
            </Card>
        );
    }

    if (isError || !data?.items?.length) {
        return (
            <Card className="rounded-lg border border-border">
                <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium">Landing Page Views Analytics</CardTitle>
                </CardHeader>
                <CardContent className="py-8 text-center text-muted-foreground text-xs">
                    No landing page views recorded yet
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="rounded-lg border border-border">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Landing Page Views Analytics</CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{data.totalCount} landings with views</span>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                        <thead className="bg-secondary border-b border-border">
                            <tr className="text-left text-muted-foreground font-medium">
                                <th className="px-3 py-2">Agent</th>
                                <th className="px-3 py-2">Property</th>
                                <th className="px-3 py-2 text-right">Price</th>
                                <th className="px-3 py-2">Type</th>
                                <th
                                    className="px-3 py-2 text-center cursor-pointer hover:text-foreground transition-colors"
                                    onClick={() => { setSortBy('views'); setPage(0); }}
                                >
                                    Views {sortBy === 'views' && '↓'}
                                </th>
                                <th className="px-3 py-2 text-center">Unique</th>
                                <th className="px-3 py-2">Device</th>
                                <th
                                    className="px-3 py-2 cursor-pointer hover:text-foreground transition-colors"
                                    onClick={() => { setSortBy('lastViewed'); setPage(0); }}
                                >
                                    Last Viewed {sortBy === 'lastViewed' && '↓'}
                                </th>
                                <th className="px-3 py-2 w-8"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {data.items.map((row) => (
                                <tr key={row.landing_id} className="hover:bg-secondary/50 transition-colors">
                                    <td className="px-3 py-2">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-foreground">{row.agent_name}</span>
                                            {row.agent_email && (
                                                <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{row.agent_email}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="text-foreground truncate max-w-[200px] block">{row.property_address}</span>
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-foreground">
                                        {formatPrice(row.property_price)}
                                    </td>
                                    <td className="px-3 py-2">
                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-none bg-secondary">
                                            {row.property_type}
                                        </Badge>
                                    </td>
                                    <td className="px-3 py-2 text-center font-mono text-foreground font-medium">
                                        {row.total_views}
                                    </td>
                                    <td className="px-3 py-2 text-center font-mono text-muted-foreground">
                                        {row.unique_visitors}
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-1.5">
                                            {row.desktop_percent > 0 && (
                                                <div className="flex items-center gap-0.5" title="Desktop">
                                                    <Monitor className="h-3 w-3 text-blue-500" />
                                                    <span className="text-[9px] text-muted-foreground">{row.desktop_percent}%</span>
                                                </div>
                                            )}
                                            {row.mobile_percent > 0 && (
                                                <div className="flex items-center gap-0.5" title="Mobile">
                                                    <Smartphone className="h-3 w-3 text-emerald-500" />
                                                    <span className="text-[9px] text-muted-foreground">{row.mobile_percent}%</span>
                                                </div>
                                            )}
                                            {row.tablet_percent > 0 && (
                                                <div className="flex items-center gap-0.5" title="Tablet">
                                                    <Tablet className="h-3 w-3 text-amber-500" />
                                                    <span className="text-[9px] text-muted-foreground">{row.tablet_percent}%</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground">
                                        {formatDate(row.last_viewed_at)}
                                    </td>
                                    <td className="px-3 py-2">
                                        {row.landing_url && (
                                            <a
                                                href={row.landing_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </a>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                        <span className="text-[10px] text-muted-foreground">
                            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data.totalCount)} of {data.totalCount}
                        </span>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground px-2">
                                {page + 1} / {totalPages}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
