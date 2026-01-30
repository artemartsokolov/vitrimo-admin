import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Scrape trending real estate content from Instagram via Apify
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
};

const HASHTAGS = ['realestate', 'realtor', 'realestatmeme', 'househunting', 'realtorlife'];

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

        // Scrape posts from real estate meme/humor accounts
        const memeAccounts = [
            'https://www.instagram.com/realestatememes/',
            'https://www.instagram.com/realtormemes/',
            'https://www.instagram.com/thebrokeagent/',
            'https://www.instagram.com/realestatejunkie/',
        ];
        const results = await callApify('apify~instagram-scraper', {
            directUrls: memeAccounts,
            resultsType: 'posts',
            resultsLimit: 10,
        });

        console.log(`Scraped ${results.length} posts`);

        // Log engagement values for debugging
        console.log('Sample engagements:', results.slice(0, 5).map((p: any) => ({
            likes: p.likesCount,
            comments: p.commentsCount,
            engagement: (p.likesCount || 0) + (p.commentsCount || 0) * 5
        })));

        const trends = results
            .filter((post: any) => {
                // Only Reels (video content)
                const isVideo = post.type === 'Video' || post.type === 'Reel' || post.videoUrl;
                const engagement = (post.likesCount || 0) + (post.commentsCount || 0) * 5;
                return isVideo && engagement > 100;
            })
            .map((post: any) => ({
                source: 'instagram',
                source_url: post.url,
                content_type: 'reel',
                caption: post.caption,
                thumbnail_url: post.displayUrl || post.thumbnailUrl,
                video_url: post.videoUrl, // For Gemini analysis
                engagement_score: (post.likesCount || 0) + (post.commentsCount || 0) * 5,
                hashtags: post.hashtags || [],
                raw_data: post,
                status: 'new',
            }))
            .slice(0, 10); // Limit to 10

        trends.sort((a: any, b: any) => b.engagement_score - a.engagement_score);

        let inserted = 0;
        for (const trend of trends) {
            const { error } = await supabase
                .from('content_trends')
                .insert(trend);
            if (error) {
                console.error('Insert error:', error.message);
            } else {
                inserted++;
            }
        }

        console.log(`Inserted ${inserted} new trends`);

        const { data: newTrends } = await supabase
            .from('content_trends')
            .select('id')
            .eq('status', 'new')
            .limit(10);

        if (newTrends?.length) {
            for (const trend of newTrends) {
                // Trigger Gemini video analysis for each new reel
                fetch(`${supabaseUrl}/functions/v1/analyze-reel`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ trend_id: trend.id }),
                }).catch(console.error);
            }
        }

        return new Response(
            JSON.stringify({ success: true, scraped: results.length, inserted, generating_scripts: newTrends?.length || 0 }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Scrape error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
