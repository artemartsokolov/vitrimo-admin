import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Sync Instagram profile metrics via Apify
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
};

// Apify API helper
const callApify = async (actorId: string, input: object) => {
    const apiKey = Deno.env.get('APIFY_API_KEY');
    if (!apiKey) throw new Error('APIFY_API_KEY not set');

    const response = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        }
    );

    if (!response.ok) {
        throw new Error(`Apify error: ${response.status}`);
    }

    const run = await response.json();
    const runId = run.data.id;

    // Wait for completion (max 60s)
    let attempts = 0;
    while (attempts < 30) {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`
        );
        const statusData = await statusRes.json();

        if (statusData.data.status === 'SUCCEEDED') {
            const datasetRes = await fetch(
                `https://api.apify.com/v2/datasets/${statusData.data.defaultDatasetId}/items?token=${apiKey}`
            );
            return await datasetRes.json();
        }

        if (statusData.data.status === 'FAILED') {
            throw new Error('Apify run failed');
        }

        attempts++;
    }

    throw new Error('Apify timeout');
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { username, user_id } = await req.json();

        if (!username) {
            return new Response(
                JSON.stringify({ error: 'username required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const cleanUsername = username.replace('@', '').trim();
        console.log(`Syncing Instagram: @${cleanUsername}`);

        // Call Apify Instagram Scraper for profile
        const results = await callApify('apify~instagram-scraper', {
            directUrls: [`https://www.instagram.com/${cleanUsername}/`],
            resultsType: 'details',
            resultsLimit: 1,
        });

        if (!results || results.length === 0) {
            return new Response(
                JSON.stringify({ error: 'Profile not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const profile = results[0];

        // Calculate engagement rate
        const recentPosts = profile.latestPosts || [];
        let avgLikes = 0;
        let avgComments = 0;

        if (recentPosts.length > 0) {
            avgLikes = Math.round(
                recentPosts.reduce((sum: number, p: any) => sum + (p.likesCount || 0), 0) / recentPosts.length
            );
            avgComments = Math.round(
                recentPosts.reduce((sum: number, p: any) => sum + (p.commentsCount || 0), 0) / recentPosts.length
            );
        }

        const engagementRate = profile.followersCount > 0
            ? ((avgLikes + avgComments) / profile.followersCount * 100).toFixed(2)
            : 0;

        // Upsert account
        const { data: account, error: accountError } = await supabase
            .from('instagram_accounts')
            .upsert({
                user_id,
                username: cleanUsername,
                profile_pic_url: profile.profilePicUrl,
                bio: profile.biography,
                last_synced_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id,username',
            })
            .select()
            .single();

        if (accountError) {
            console.error('Account upsert error:', accountError);
            throw accountError;
        }

        // Insert metrics snapshot
        await supabase
            .from('instagram_metrics')
            .insert({
                account_id: account.id,
                followers: profile.followersCount,
                following: profile.followsCount,
                posts_count: profile.postsCount,
                avg_likes: avgLikes,
                avg_comments: avgComments,
                engagement_rate: parseFloat(engagementRate as string),
            });

        // Get recent metrics for comparison
        const { data: recentMetrics } = await supabase
            .from('instagram_metrics')
            .select('followers, recorded_at')
            .eq('account_id', account.id)
            .order('recorded_at', { ascending: false })
            .limit(7);

        const followersChange = recentMetrics && recentMetrics.length > 1
            ? profile.followersCount - recentMetrics[recentMetrics.length - 1].followers
            : 0;

        return new Response(
            JSON.stringify({
                success: true,
                profile: {
                    username: cleanUsername,
                    profile_pic_url: profile.profilePicUrl,
                    followers: profile.followersCount,
                    following: profile.followsCount,
                    posts: profile.postsCount,
                    avg_likes: avgLikes,
                    avg_comments: avgComments,
                    engagement_rate: parseFloat(engagementRate as string),
                    followers_change: followersChange,
                },
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Sync error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
