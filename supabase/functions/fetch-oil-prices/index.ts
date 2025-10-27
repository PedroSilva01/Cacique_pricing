// Supabase Edge Function for fetching oil prices
// Deploy with: supabase functions deploy fetch-oil-prices --no-verify-jwt
// Set API key: supabase secrets set OIL_PRICE_API_KEY=your_key_here

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OilPriceData {
  WTI?: {
    price: number;
    change: string;
    currency: string;
    unit: string;
    timestamp: string;
  };
  BRENT?: {
    price: number;
    change: string;
    currency: string;
    unit: string;
    timestamp: string;
  };
}

async function fetchOilPrices(apiKey: string): Promise<OilPriceData> {
  try {
    // Fetch WTI price first
    const wtiResponse = await fetch('https://api.oilpriceapi.com/v1/prices/latest?by_code=WTI_USD', {
      headers: {
        'Authorization': `Token ${apiKey}`
      }
    });

    if (!wtiResponse.ok) {
      const errorText = await wtiResponse.text();
      console.error('API Error Response (WTI):', errorText);
      throw new Error(`API request failed: ${wtiResponse.status} ${wtiResponse.statusText}`);
    }

    const wtiResult = await wtiResponse.json();
    console.log('WTI API Response:', JSON.stringify(wtiResult));
    
    // Try to fetch BRENT separately
    let brentResult = null;
    try {
      const brentResponse = await fetch('https://api.oilpriceapi.com/v1/prices/latest?by_code=BRENT_USD', {
        headers: {
          'Authorization': `Token ${apiKey}`
        }
      });
      
      if (brentResponse.ok) {
        brentResult = await brentResponse.json();
        console.log('BRENT API Response:', JSON.stringify(brentResult));
      }
    } catch (brentError) {
      console.log('BRENT fetch failed, will estimate based on WTI');
    }
    
    const transformedData: OilPriceData = {};
    
    // Handle WTI - API pode retornar array prices OU objeto direto
    if (wtiResult.status === 'success' && wtiResult.data) {
      let wtiData;
      
      // Caso 1: Array prices (múltiplos códigos)
      if (wtiResult.data.prices && Array.isArray(wtiResult.data.prices)) {
        wtiData = wtiResult.data.prices.find((p: any) => p.code === 'WTI_USD');
      }
      // Caso 2: Objeto direto (código individual)
      else if (wtiResult.data.code === 'WTI_USD') {
        wtiData = wtiResult.data;
      }
      
      if (wtiData && wtiData.price) {
        transformedData.WTI = {
          price: wtiData.price,
          change: '+0.00%',
          currency: wtiData.currency || 'USD',
          unit: 'barrel',
          timestamp: wtiData.created_at || new Date().toISOString()
        };
        
        console.log('WTI parsed successfully:', wtiData.price);
        
        // If BRENT not available, estimate it (historically BRENT is ~3-5% higher than WTI)
        if (!brentResult || !brentResult.data) {
          const brentEstimated = wtiData.price * 1.04; // 4% premium typical
          transformedData.BRENT = {
            price: parseFloat(brentEstimated.toFixed(2)),
            change: '+0.00%',
            currency: 'USD',
            unit: 'barrel',
            timestamp: wtiData.created_at || new Date().toISOString()
          };
          console.log('BRENT estimated based on WTI:', brentEstimated);
        }
      }
    }
    
    // Handle BRENT if we got actual data
    if (brentResult && brentResult.status === 'success' && brentResult.data) {
      let brentData;
      
      // Caso 1: Array prices
      if (brentResult.data.prices && Array.isArray(brentResult.data.prices)) {
        brentData = brentResult.data.prices.find((p: any) => p.code === 'BRENT_USD');
      }
      // Caso 2: Objeto direto
      else if (brentResult.data.code === 'BRENT_USD') {
        brentData = brentResult.data;
      }
      
      if (brentData && brentData.price) {
        transformedData.BRENT = {
          price: brentData.price,
          change: '+0.00%',
          currency: brentData.currency || 'USD',
          unit: 'barrel',
          timestamp: brentData.created_at || new Date().toISOString()
        };
        console.log('BRENT parsed successfully:', brentData.price);
      }
    }
    
    return transformedData;
  } catch (error) {
    console.error('Error fetching oil prices from API:', error);
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== FUNCTION STARTED ===');
    
    // Get API key from environment
    const apiKey = Deno.env.get('OIL_PRICE_API_KEY');
    console.log('API Key exists:', !!apiKey);
    
    // Always start with mock data as baseline
    let data: OilPriceData = {
      WTI: {
        price: 61.47,
        change: '+0.00%',
        currency: 'USD',
        unit: 'barrel',
        timestamp: new Date().toISOString()
      },
      BRENT: {
        price: 63.93,
        change: '+0.00%',
        currency: 'USD',
        unit: 'barrel',
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('Mock data initialized:', JSON.stringify(data));
    
    if (apiKey) {
      try {
        console.log('Fetching from API...');
        data = await fetchOilPrices(apiKey);
        console.log('API data received:', JSON.stringify(data));
      } catch (apiError) {
        console.error('API fetch failed, using mock data:', apiError);
      }
    } else {
      console.log('No API key, using mock data');
    }
    
    console.log('Final data to return:', JSON.stringify(data));
    
    return new Response(
      JSON.stringify({ data }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in fetch-oil-prices function:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Return mock data even on error so frontend always has something
    const fallbackData: OilPriceData = {
      WTI: {
        price: 61.47,
        change: '+0.00%',
        currency: 'USD',
        unit: 'barrel',
        timestamp: new Date().toISOString()
      },
      BRENT: {
        price: 63.93,
        change: '+0.00%',
        currency: 'USD',
        unit: 'barrel',
        timestamp: new Date().toISOString()
      }
    };
    
    return new Response(
      JSON.stringify({ data: fallbackData }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
