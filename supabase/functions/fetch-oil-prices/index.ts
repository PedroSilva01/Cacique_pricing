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

interface OilPriceApiEntry {
  code?: string;
  price?: number;
  currency?: string;
  created_at?: string;
}

interface OilPriceApiResponse {
  status?: string;
  data?: {
    code?: string;
    price?: number;
    currency?: string;
    created_at?: string;
    prices?: OilPriceApiEntry[];
  };
}

const DEFAULT_WTI_PRICE = 61.47;
const DEFAULT_BRENT_PRICE = 63.93;

function extractPriceEntry(result: OilPriceApiResponse | null, code: string): OilPriceApiEntry | null {
  if (!result || result.status !== 'success' || !result.data) {
    return null;
  }

  const { data } = result;

  if (Array.isArray(data.prices)) {
    const entry = data.prices.find((priceItem) => priceItem.code === code);
    return entry ?? null;
  }

  if (data.code === code) {
    return {
      code: data.code,
      price: data.price,
      currency: data.currency,
      created_at: data.created_at,
    };
  }

  return null;
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

    const wtiResult: OilPriceApiResponse = await wtiResponse.json();
    console.log('WTI API Response:', JSON.stringify(wtiResult));
    
    // Try to fetch BRENT separately
    let brentResult = null;
    try {
      const brentResponse = await fetch('https://api.oilpriceapi.com/v1/prices/latest?by_code=BRENT_CRUDE_USD', {
        headers: {
          'Authorization': `Token ${apiKey}`
        }
      });
      
      if (brentResponse.ok) {
        brentResult = (await brentResponse.json()) as OilPriceApiResponse;
        console.log('BRENT API Response:', JSON.stringify(brentResult));
      }
    } catch (_brentError) {
      console.log('BRENT fetch failed, will estimate based on WTI');
    }
    
    const transformedData: OilPriceData = {};
    
    // Handle WTI - API pode retornar array prices OU objeto direto
    const wtiData = extractPriceEntry(wtiResult, 'WTI_USD');

    if (wtiData?.price && typeof wtiData.price === 'number') {
      transformedData.WTI = {
        price: wtiData.price,
        change: '+0.00%',
        currency: wtiData.currency ?? 'USD',
        unit: 'barrel',
        timestamp: wtiData.created_at ?? new Date().toISOString(),
      };

      console.log('WTI parsed successfully:', wtiData.price);
    } else {
      transformedData.WTI = {
        price: DEFAULT_WTI_PRICE,
        change: '+0.00%',
        currency: 'USD',
        unit: 'barrel',
        timestamp: new Date().toISOString(),
      };
      console.log('WTI fallback applied');
    }

    // Handle BRENT: usar o valor real da API quando disponível; caso contrário, aplicar apenas um default estático
    const brentData = extractPriceEntry(brentResult, 'BRENT_CRUDE_USD');

    if (brentData?.price && typeof brentData.price === 'number') {
      transformedData.BRENT = {
        price: brentData.price,
        change: '+0.00%',
        currency: brentData.currency ?? 'USD',
        unit: 'barrel',
        timestamp: brentData.created_at ?? new Date().toISOString(),
      };
      console.log('BRENT parsed successfully:', brentData.price);
    } else {
      transformedData.BRENT = {
        price: DEFAULT_BRENT_PRICE,
        change: '+0.00%',
        currency: 'USD',
        unit: 'barrel',
        timestamp: transformedData.WTI?.timestamp ?? new Date().toISOString(),
      };
      console.log('BRENT fallback applied with default price:', transformedData.BRENT.price);
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
