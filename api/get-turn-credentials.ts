import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiToken = process.env.TURNIX_API_TOKEN;
  
  if (!apiToken) {
    // Return empty array so app falls back to STUN-only
    return res.status(200).json({ iceServers: [] });
  }

  try {
    const response = await fetch('https://turnix.io/api/v1/credentials/ice', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Turnix API error: ${response.status} ${response.statusText}`);
      // Return empty array so app falls back to STUN-only
      return res.status(200).json({ iceServers: [] });
    }

    const data = await response.json();
    
    // Turnix returns { iceServers: [...] } format
    // Cache for 1 hour (credentials are typically short-lived but this reduces API calls)
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching TURN credentials:', error);
    // Return empty array so app falls back to STUN-only (graceful degradation)
    return res.status(200).json({ iceServers: [] });
  }
}

