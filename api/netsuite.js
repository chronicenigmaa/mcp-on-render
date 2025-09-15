const crypto = require('crypto');

export default async function handler(req, res) {
  // Enable CORS for ChatGPT
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Debug logging
  console.log('=== DEBUG INFO ===');
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);
  console.log('Environment variables check:');
  console.log('- Account ID:', process.env.NETSUITE_ACCOUNT_ID ? 'Set' : 'Missing');
  console.log('- Consumer Key:', process.env.NETSUITE_CONSUMER_KEY ? 'Set' : 'Missing');
  console.log('- Username:', process.env.NETSUITE_USERNAME ? 'Set' : 'Missing');
  // Your NetSuite credentials - SET THESE IN VERCEL ENVIRONMENT VARIABLES
  const config = {
    accountId: process.env.NETSUITE_ACCOUNT_ID || '8231075',
    consumerKey: process.env.NETSUITE_CONSUMER_KEY || 'f6a14ecee4e64957a1631a813fe54ee0ed907566feaed5c01ed7d4f4adb78297',
    consumerSecret: process.env.NETSUITE_CONSUMER_SECRET || 'f6494b9f9ca5c3fe8dc93f293b2b1c3393a2c34e94fb1821b035bc24647d1940',
    username: process.env.NETSUITE_USERNAME || 'zeke.e@californiachemical.com',
    password: process.env.NETSUITE_PASSWORD || 'Zain2025!!!',
    role: process.env.NETSUITE_ROLE || '17', // Workflow Administrator role ID
    account: process.env.NETSUITE_ACCOUNT_ID || '8231075'
  };

// Check if credentials are set
  if (!config.consumerKey || !config.consumerSecret) {
    return res.status(500).json({
      error: 'NetSuite credentials not configured',
      missing: {
        consumerKey: !config.consumerKey,
        consumerSecret: !config.consumerSecret,
        username: !config.username,
        password: !config.password
      }
    });
  }

  // Simple Basic Auth function (most reliable)
  function generateBasicAuth() {
    if (!config.username || !config.password) {
      throw new Error('Username or password not set');
    }
    const credentials = `${config.username}:${config.password}`;
    const encoded = Buffer.from(credentials).toString('base64');
    return `Basic ${encoded}`;
  }

  // Simplified OAuth 1.0 (no token required)
  function generateOAuth1Header(url, method = 'GET') {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    
    const oauthParams = {
      oauth_consumer_key: config.consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_version: '1.0'
    };
    
    // Create signature base string
    const paramsString = Object.keys(oauthParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
      .join('&');
      
    const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramsString)}`;
    
    // Create signing key (only consumer secret)
    const signingKey = `${encodeURIComponent(config.consumerSecret)}&`;
    
    // Generate signature using HMAC-SHA1
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(baseString)
      .digest('base64');
    
    oauthParams.oauth_signature = signature;
    
    // Create authorization header
    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
      .join(', ');
    
    return authHeader;
  }

  try {
    // Extract the path from request
    let path = req.url;
    if (path.startsWith('/api/netsuite')) {
      path = path.replace('/api/netsuite', '');
    }
    
    // Default to customer endpoint if no path specified
    if (!path || path === '/') {
      path = '/record/v1/customer?limit=5';
    }
    
    // Build NetSuite URL
    const netsuiteUrl = `https://${config.accountId}.suitetalk.api.netsuite.com/services/rest${path}`;
    
    console.log('Built NetSuite URL:', netsuiteUrl);
    
    // Try Basic Auth first (most reliable)
    let authHeader;
    let authMethod;
    
    try {
      authHeader = generateBasicAuth();
      authMethod = 'Basic';
      console.log('Using Basic Auth');
    } catch (basicError) {
      console.log('Basic Auth failed, trying OAuth 1.0:', basicError.message);
      try {
        authHeader = generateOAuth1Header(netsuiteUrl, req.method);
        authMethod = 'OAuth1';
        console.log('Using OAuth 1.0');
      } catch (oauthError) {
        console.log('OAuth 1.0 failed:', oauthError.message);
        return res.status(500).json({
          error: 'Authentication setup failed',
          basicError: basicError.message,
          oauthError: oauthError.message
        });
      }
    }
    
    console.log('Auth method:', authMethod);
    console.log('Auth header preview:', authHeader.substring(0, 50) + '...');
    
    // Make request to NetSuite with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
    
    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'NetSuite-ChatGPT-Proxy/1.0'
      },
      signal: controller.signal
    };
    
    // Add body for POST/PATCH requests
    if (req.method !== 'GET' && req.method !== 'DELETE' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }
    
    console.log('Making request to NetSuite...');
    const response = await fetch(netsuiteUrl, fetchOptions);
    clearTimeout(timeoutId);
    
    console.log('NetSuite response status:', response.status);
    console.log('NetSuite response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('NetSuite response preview:', responseText.substring(0, 300) + '...');
    
    // Try to parse as JSON, fallback to text
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = { 
        raw: responseText, 
        status: response.status,
        parseError: e.message
      };
    }
    
    res.status(response.status).json(data);
    
  } catch (error) {
    console.error('=== PROXY ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error cause:', error.cause);
    console.error('Full error:', error);
    
    res.status(500).json({ 
      error: 'Proxy server error',
      message: error.message,
      name: error.name,
      cause: error.cause?.toString(),
      config: {
        accountId: config.accountId,
        hasConsumerKey: !!config.consumerKey,
        hasUsername: !!config.username
      }
    });
  }
}
}

