import { serve } from "https://deno.land/std/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const urlParam = new URL(req.url).searchParams.get("url");
  if (!urlParam) return new Response("No URL provided", { status: 400, headers: corsHeaders });

  try {
    // 1. Clean the URL: Remove /chapters/ and specific chapter IDs
    let cleanUrl = urlParam.split('?')[0]; // Remove existing queries
    if (cleanUrl.includes('/chapters/')) {
        cleanUrl = cleanUrl.split('/chapters/')[0];
    }

    // 2. Force full work and adult view
    const targetUrl = `${cleanUrl}?view_adult=true`;
    
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
      },
    });

    const html = await res.text();
    return new Response(html, { headers: { ...corsHeaders, "Content-Type": "text/html" } });
  } catch (error) {
    return new Response(error.message, { status: 500, headers: corsHeaders });
  }
});