import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type DailyData = {
    emailsSent: number;
    totalViews: number;
    uniqueViews: number;
    newLeads: number;
    claimsClicked: number;
    registrations: number;
    userProjects: number;
};

type ChartDataPoint = DailyData & {
    date: string;
    rawDate: string;
    conversionRate: number;
};

export const ActivityTrendsChart = () => {
    const [isTouchDevice, setIsTouchDevice] = useState(false);

    useEffect(() => {
        setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }, []);

    const { data: chartData, isLoading, isError } = useQuery<ChartDataPoint[]>({
        queryKey: ['activity-trends'],
        queryFn: async () => {
            try {
                const daysAgo = 14;
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - daysAgo);
                const startDateStr = startDate.toISOString().split('T')[0];

                // Fetch emails sent history from cold_leads
                const { data: leadsEmailHistory, error: emailError } = await (supabase as any)
                    .from('cold_leads')
                    .select('email1_sent, email2_sent, email3_sent')
                    .or(`email1_sent.gte.${startDateStr},email2_sent.gte.${startDateStr},email3_sent.gte.${startDateStr}`);

                if (emailError) console.warn('Email history query error:', emailError);

                // Fetch landing views with visitor_id for unique counting
                // Exclude admin views (artemvitrimo@gmail.com)
                const { data: pageViewData, error: viewsError } = await (supabase as any)
                    .from('page_view_events')
                    .select('viewed_at, visitor_id, session_id, user_id')
                    .gte('viewed_at', startDateStr)
                    .or('user_id.is.null,user_id.neq.artemvitrimo@gmail.com');

                if (viewsError) console.warn('Page views query error:', viewsError);
                console.log('pageViewData:', pageViewData?.length, 'records, sample:', pageViewData?.slice(0, 3));

                // Fetch new leads by day
                const { data: newLeads, error: leadsError } = await (supabase as any)
                    .from('cold_leads')
                    .select('created_at')
                    .gte('created_at', startDateStr);

                if (leadsError) console.warn('Leads query error:', leadsError);

                // Fetch claims by day
                const { data: claimsData, error: claimsError } = await (supabase as any)
                    .from('cta_click_events')
                    .select('created_at')
                    .eq('cta_type', 'claim_page')
                    .gte('created_at', startDateStr);

                if (claimsError) console.warn('Claims query error:', claimsError);

                // Fetch User Registrations
                const { data: registrationData, error: regError } = await supabase.functions.invoke('get-dashboard-stats', {
                    body: { days: daysAgo }
                });

                // Fetch User Projects (Manual)
                const { data: manualProjects, error: manError } = await supabase
                    .from('landing_projects')
                    .select('created_at')
                    .neq('template_id', 'marketing-outreach')
                    .gte('created_at', startDateStr);

                if (regError) console.warn('Registration stats error:', regError);
                if (manError) console.warn('Manual project stats error:', manError);

                const dailyRegistrations = registrationData?.dailyRegistrations || {};

                // Group by day
                const dailyData: Record<string, DailyData & { visitorIds: Set<string> }> = {};

                // Initialize all days
                for (let i = 0; i <= daysAgo; i++) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    const dayKey = date.toISOString().split('T')[0];
                    dailyData[dayKey] = {
                        emailsSent: 0,
                        totalViews: 0,
                        uniqueViews: 0,
                        newLeads: 0,
                        claimsClicked: 0,
                        registrations: 0,
                        userProjects: 0,
                        visitorIds: new Set()
                    };
                }

                // Count emails
                (leadsEmailHistory || []).forEach((l: any) => {
                    if (l.email1_sent && l.email1_sent >= startDateStr) {
                        const dayKey = l.email1_sent.split('T')[0];
                        if (dailyData[dayKey]) dailyData[dayKey].emailsSent++;
                    }
                    if (l.email2_sent && l.email2_sent >= startDateStr) {
                        const dayKey = l.email2_sent.split('T')[0];
                        if (dailyData[dayKey]) dailyData[dayKey].emailsSent++;
                    }
                    if (l.email3_sent && l.email3_sent >= startDateStr) {
                        const dayKey = l.email3_sent.split('T')[0];
                        if (dailyData[dayKey]) dailyData[dayKey].emailsSent++;
                    }
                });

                // Count views (total and unique by visitor_id or session_id)
                (pageViewData || []).forEach((pv: any) => {
                    if (pv.viewed_at) {
                        const dayKey = pv.viewed_at.split('T')[0];
                        if (dailyData[dayKey]) {
                            dailyData[dayKey].totalViews++;

                            // Track unique by visitor_id or session_id
                            const visitorKey = pv.visitor_id || pv.session_id || `anon-${dailyData[dayKey].totalViews}`;
                            dailyData[dayKey].visitorIds.add(visitorKey);
                        }
                    }
                });

                // Count new leads
                (newLeads || []).forEach((u: any) => {
                    if (u.created_at) {
                        const dayKey = u.created_at.split('T')[0];
                        if (dailyData[dayKey]) dailyData[dayKey].newLeads++;
                    }
                });

                // Count claims
                (claimsData || []).forEach((c: any) => {
                    if (c.created_at) {
                        const dayKey = c.created_at.split('T')[0];
                        if (dailyData[dayKey]) dailyData[dayKey].claimsClicked++;
                    }
                });

                // Count user projects
                (manualProjects || []).forEach((p: any) => {
                    if (p.created_at) {
                        const dayKey = p.created_at.split('T')[0];
                        if (dailyData[dayKey]) dailyData[dayKey].userProjects++;
                    }
                });

                // Add registrations
                Object.entries(dailyRegistrations).forEach(([date, count]) => {
                    if (dailyData[date]) {
                        dailyData[date].registrations = Number(count);
                    }
                });

                // Convert to array
                return Object.entries(dailyData)
                    .map(([date, data]) => ({
                        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        rawDate: date,
                        emailsSent: data.emailsSent,
                        totalViews: data.totalViews,
                        uniqueViews: data.visitorIds.size,
                        newLeads: data.newLeads,
                        claimsClicked: data.claimsClicked,
                        registrations: data.registrations,
                        userProjects: data.userProjects,
                        conversionRate: data.emailsSent > 0
                            ? Math.round((data.totalViews / data.emailsSent) * 100)
                            : 0
                    }))
                    .sort((a, b) => a.rawDate.localeCompare(b.rawDate));
            } catch (err) {
                console.error('ActivityTrendsChart query error:', err);
                return [];
            }
        },
        refetchInterval: 60000,
        staleTime: 30000
    });

    // Device breakdown query
    const { data: deviceData } = useQuery<{ name: string; value: number; color: string }[]>({
        queryKey: ['device-breakdown'],
        queryFn: async () => {
            try {
                const daysAgo = 14;
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - daysAgo);
                const startDateStr = startDate.toISOString().split('T')[0];

                const { data: pageViews, error } = await (supabase as any)
                    .from('page_view_events')
                    .select('user_agent')
                    .gte('viewed_at', startDateStr)
                    .or('user_id.is.null,user_id.neq.artemvitrimo@gmail.com');

                if (error) {
                    console.warn('Device breakdown query error:', error);
                    return [];
                }

                const counts = { desktop: 0, mobile: 0, tablet: 0 };

                (pageViews || []).forEach((pv: { user_agent?: string }) => {
                    const ua = (pv.user_agent || '').toLowerCase();
                    if (/ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) {
                        counts.tablet++;
                    } else if (/mobile|iphone|ipod|android.*mobile|blackberry|opera mini|iemobile/i.test(ua)) {
                        counts.mobile++;
                    } else {
                        counts.desktop++;
                    }
                });

                return [
                    { name: 'Desktop', value: counts.desktop, color: '#3b82f6' },
                    { name: 'Mobile', value: counts.mobile, color: '#10b981' },
                    { name: 'Tablet', value: counts.tablet, color: '#f59e0b' },
                ].filter(d => d.value > 0);
            } catch (err) {
                console.error('Device breakdown error:', err);
                return [];
            }
        },
        refetchInterval: 60000,
        staleTime: 30000
    });

    if (isLoading) {
        return (
            <Card className="rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground text-center py-8">Loading chart data...</div>
            </Card>
        );
    }

    if (isError || !chartData || chartData.length === 0) {
        return (
            <Card className="rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground text-center py-8">No chart data available</div>
            </Card>
        );
    }

    return (
        <>
            <Card className="rounded-lg border border-border">
                <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium">Activity Trends (Last 14 Days)</CardTitle>
                </CardHeader>
                <CardContent className="pb-4 px-2 md:px-4">
                    <div className="h-[300px] md:h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 10, fill: '#8B8B8B' }}
                                    tickLine={false}
                                    axisLine={{ stroke: '#333333' }}
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: '#8B8B8B' }}
                                    tickLine={false}
                                    axisLine={{ stroke: '#333333' }}
                                    width={30}
                                />
                                <Tooltip
                                    contentStyle={{
                                        fontSize: 12,
                                        borderRadius: 8,
                                        border: '1px solid #333333',
                                        backgroundColor: '#202020',
                                        color: '#E8E8E8',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
                                        padding: '10px 14px'
                                    }}
                                    cursor={{ strokeDasharray: '3 3', stroke: '#555' }}
                                    isAnimationActive={false}
                                    labelStyle={{ color: '#E8E8E8', fontWeight: 'bold', marginBottom: 4 }}
                                    trigger={isTouchDevice ? 'click' : 'hover'}
                                />
                                <Legend
                                    wrapperStyle={{ fontSize: 10, paddingTop: 10 }}
                                    formatter={(value) => <span style={{ color: '#8B8B8B' }}>{value}</span>}
                                />

                                <Line
                                    type="monotone"
                                    dataKey="emailsSent"
                                    name="Emails Sent"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dot={{ fill: '#3b82f6', strokeWidth: 0, r: 5 }}
                                    activeDot={{ r: 8, stroke: '#3b82f6', strokeWidth: 2 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="totalViews"
                                    name="Total Views"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    dot={{ fill: '#10b981', strokeWidth: 0, r: 5 }}
                                    activeDot={{ r: 8, stroke: '#10b981', strokeWidth: 2 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="uniqueViews"
                                    name="Unique Views"
                                    stroke="#06b6d4"
                                    strokeWidth={2}
                                    strokeDasharray="4 2"
                                    dot={{ fill: '#06b6d4', strokeWidth: 0, r: 3 }}
                                    activeDot={{ r: 5 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="userProjects"
                                    name="User Projects"
                                    stroke="#f97316"
                                    strokeWidth={2}
                                    dot={{ fill: '#f97316', strokeWidth: 0, r: 3 }}
                                    activeDot={{ r: 5 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="newLeads"
                                    name="New Leads"
                                    stroke="#8b5cf6"
                                    strokeWidth={2}
                                    dot={{ fill: '#8b5cf6', strokeWidth: 0, r: 3 }}
                                    activeDot={{ r: 5 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="claimsClicked"
                                    name="Claims"
                                    stroke="#E1224D"
                                    strokeWidth={2}
                                    dot={{ fill: '#E1224D', strokeWidth: 0, r: 3 }}
                                    activeDot={{ r: 5 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="conversionRate"
                                    name="Conversion %"
                                    stroke="#f59e0b"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={{ fill: '#f59e0b', strokeWidth: 0, r: 3 }}
                                    activeDot={{ r: 5 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="registrations"
                                    name="Registrations"
                                    stroke="#E8E8E8"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={{ fill: '#E8E8E8', strokeWidth: 0, r: 3 }}
                                    activeDot={{ r: 5 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Device Breakdown Donut Chart */}
            {
                deviceData && deviceData.length > 0 && (
                    <Card className="rounded-lg border border-border mt-4">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm font-medium">Device Breakdown (Last 14 Days)</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4 px-4">
                            <div className="flex items-center gap-8">
                                <div className="h-[180px] w-[180px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={deviceData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={50}
                                                outerRadius={80}
                                                paddingAngle={2}
                                                dataKey="value"
                                            >
                                                {deviceData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{
                                                    fontSize: 12,
                                                    borderRadius: 8,
                                                    border: '1px solid #333333',
                                                    backgroundColor: '#202020',
                                                    color: '#E8E8E8',
                                                }}
                                                formatter={(value: number) => [`${value} views`, '']}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {deviceData.map((device) => {
                                        const total = deviceData.reduce((sum, d) => sum + d.value, 0);
                                        const percent = total > 0 ? Math.round((device.value / total) * 100) : 0;
                                        return (
                                            <div key={device.name} className="flex items-center gap-3">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: device.color }}
                                                />
                                                <span className="text-sm text-foreground">{device.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {device.value} ({percent}%)
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )
            }
        </>
    );
};
