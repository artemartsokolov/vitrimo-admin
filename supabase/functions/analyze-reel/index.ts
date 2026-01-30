import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Analyze Instagram Reel video content using Gemini 2.0 Flash
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
};

// Analyze video with Gemini
const analyzeWithGemini = async (videoUrl: string, caption: string) => {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    // Download video and convert to base64
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) throw new Error('Failed to download video');

    const videoBlob = await videoResponse.arrayBuffer();
    const base64Video = btoa(String.fromCharCode(...new Uint8Array(videoBlob)));

    const prompt = `You are analyzing a viral Instagram Reel about real estate. 
    
Caption: "${caption}"

Analyze this video and provide:
1. **Hook** (first 3 seconds): What grabs attention immediately?
2. **Main Message**: What's the core message or joke?
3. **Format/Style**: Is it a meme, skit, talking head, POV, etc?
4. **Why It Works**: Why is this engaging for real estate agents?
5. **Script Breakdown**: Step-by-step what happens in the video (timestamps if possible)
6. **Recreate Idea**: How could a realtor recreate this concept for their own content?

Be specific and actionable.`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            inlineData: {
                                mimeType: 'video/mp4',
                                data: base64Video
                            }
                        },
                        { text: prompt }
                    ]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                }
            })
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini error: ${error}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { trend_id } = await req.json();
        if (!trend_id) {
            return new Response(
                JSON.stringify({ error: 'trend_id required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get trend with video URL
        const { data: trend, error: fetchError } = await supabase
            .from('content_trends')
            .select('*')
            .eq('id', trend_id)
            .single();

        if (fetchError || !trend) {
            return new Response(
                JSON.stringify({ error: 'Trend not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get video URL from raw_data or video_url field
        const videoUrl = trend.video_url || trend.raw_data?.videoUrl;
        if (!videoUrl) {
            return new Response(
                JSON.stringify({ error: 'No video URL for this trend' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`Analyzing reel: ${trend_id}`);

        // Analyze with Gemini
        const analysis = await analyzeWithGemini(videoUrl, trend.caption || '');

        // Update trend with analysis
        const { error: updateError } = await supabase
            .from('content_trends')
            .update({
                status: 'analyzed',
                raw_data: {
                    ...trend.raw_data,
                    gemini_analysis: analysis
                }
            })
            .eq('id', trend_id);

        if (updateError) {
            console.error('Update error:', updateError);
        }

        console.log(`Analysis complete for: ${trend_id}`);

        return new Response(
            JSON.stringify({
                success: true,
                trend_id,
                analysis
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Analyze error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
