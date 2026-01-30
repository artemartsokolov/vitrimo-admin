import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Shared Supabase client
export const getSupabaseClient = () => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    return createClient(supabaseUrl, supabaseKey);
};

// Apify API helper
export const callApify = async (actorId: string, input: object) => {
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

    // Wait for completion (max 60s)
    const runId = run.data.id;
    let attempts = 0;
    while (attempts < 30) {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`
        );
        const statusData = await statusRes.json();

        if (statusData.data.status === 'SUCCEEDED') {
            // Fetch dataset
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

// OpenAI helper
export const callOpenAI = async (messages: { role: string; content: string }[]) => {
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

// CORS headers
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
