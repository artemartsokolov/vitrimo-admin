import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Generate video scripts for a trend using OpenAI
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
};

const STYLES = ['funny', 'educational', 'storytelling'] as const;

const SYSTEM_PROMPT = `You are a viral content strategist for real estate agents. 
Create short-form video scripts (15-30 seconds) that are:
- Engaging and hook viewers in first 3 seconds
- Relatable to home buyers/sellers
- End with a clear call-to-action

Format your response as JSON:
{
  "hook": "First 3 seconds text",
  "script": "Full script with timing markers like [HOOK 0:00-0:03], [MAIN 0:03-0:25], [CTA 0:25-0:30]",
  "duration": 30,
  "score": 85
}

Score is your confidence in the script going viral (0-100).`;

// OpenAI helper
const callOpenAI = async (messages: { role: string; content: string }[]) => {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.8,
            max_tokens: 1000,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { trend_id } = await req.json();

        if (!trend_id) {
            return new Response(
                JSON.stringify({ error: 'trend_id required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { data: trend, error: trendError } = await supabase
            .from('content_trends')
            .select('*')
            .eq('id', trend_id)
            .single();

        if (trendError || !trend) {
            return new Response(
                JSON.stringify({ error: 'Trend not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        await supabase
            .from('content_trends')
            .update({ status: 'processing' })
            .eq('id', trend_id);

        console.log(`Generating scripts for trend: ${trend.caption?.slice(0, 50)}...`);

        const scripts = [];
        const stylesToGenerate = STYLES.slice(0, Math.floor(Math.random() * 2) + 2);

        for (const style of stylesToGenerate) {
            const stylePrompts = {
                funny: 'Create a FUNNY, meme-style script. Use humor, exaggeration, and relatable pain points.',
                educational: 'Create an EDUCATIONAL script. Share valuable tips, insider knowledge, or market insights.',
                storytelling: 'Create a STORYTELLING script. Tell a compelling story with a beginning, twist, and resolution.',
            };

            const userPrompt = `Based on this trending content:
"${trend.caption}"

Source: ${trend.source} (${trend.engagement_score} engagement)
Hashtags: ${trend.hashtags?.join(', ') || 'N/A'}

${stylePrompts[style]}

Generate a 30-second video script.`;

            try {
                const response = await callOpenAI([
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt },
                ]);

                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    scripts.push({
                        trend_id,
                        style,
                        hook: parsed.hook,
                        script_text: parsed.script,
                        duration_seconds: parsed.duration || 30,
                        score: Math.min(100, Math.max(0, parsed.score || 75)),
                        status: 'new',
                    });
                }
            } catch (e) {
                console.error(`Failed to generate ${style} script:`, e);
            }
        }

        if (scripts.length > 0) {
            await supabase.from('video_scripts').insert(scripts);
        }

        await supabase
            .from('content_trends')
            .update({ status: 'processed' })
            .eq('id', trend_id);

        return new Response(
            JSON.stringify({ success: true, trend_id, scripts_generated: scripts.length }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Generate error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
