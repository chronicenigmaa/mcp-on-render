// api/netsuite.js - Deploy to Vercel
const crypto = require('crypto');

export default async function handler(req, res) {
  // Enable CORS for ChatGPT
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Your NetSuite credentials - SET THESE IN VERCEL ENVIRONMENT VARIABLES
  const config = {
    accountId: process.env.NETSUITE_ACCOUNT_ID || '8231075',
    consumerKey: process.env.NETSUITE_CONSUMER_KEY || 'YOUR_CONSUMER_KEY',
    consumerSecret: process.env.NETSUITE_CONSUMER_SECRET || 'YOUR_CONSUMER_SECRET',
    username: process.env.NETSUITE_USERNAME || 'YOUR_USERNAME',
    password: process.env.NETSUITE_PASSWORD || 'YOUR_PASSWORD',
    role: process.env.NETSUITE_ROLE || '17', // Workflow Administrator role ID
    account: process.env.NETSUITE_ACCOUNT_ID || '8231075'
  };

  // NetSuite Workflow Administrator Authentication
  function generateNetSuiteAuth() {
    // For Workflow Administrator role, use NLAuth (NetSuite Login Authentication)
    const nlAuth = `NLAuth nlauth_account=${config.account}, nlauth_email=${config.username}, nlauth_signature=${config.password}, nlauth_role=${config.role}`;
    return nlAuth;
  }

  // Alternative: Basic Authentication for REST API
  function generateBasicAuth() {
    const credentials = `${config.username}:${config.password}`;
    const encoded = Buffer.from(credentials).toString('base64');
    return `Basic ${encoded}`;
  }

  // OAuth 1.0 for Workflow Administrator (simplified)
  function generateOAuth1Header(url, method = 'GET') {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    
    const oauthParams = {
      oauth_consumer_key: config.consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA256',
      oauth_timestamp: timestamp,
      oauth_version: '1.0'
    };
    
    // Create signature base string
    const paramsString = Object.keys(oauthParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
      .join('&');
      
    const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramsString)}`;
    
    // Create signing key for Workflow Administrator (only consumer secret)
    const signingKey = `${encodeURIComponent(config.consumerSecret)}&`;
    
    // Generate signature
    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(baseString)
      .digest('base64');
    
    oauthParams.oauth_signature = signature;
    
    // Create authorization header
    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
      .join(', ');
    
    return authHeader;
  }

  try {
    // Extract the path from request
    const path = req.url.startsWith('/api/netsuite') 
      ? req.url.replace('/api/netsuite', '') 
      : req.url;
    
    // Build NetSuite URL
    const netsuiteUrl = `https://${config.accountId}.suitetalk.api.netsuite.com/services/rest${path}`;
    
    // Try multiple authentication methods for Workflow Administrator
    let authHeader;
    let authMethod = 'unknown';
    
    try {
      // Method 1: Try NLAuth (NetSuite Login Authentication)
      authHeader = generateNetSuiteAuth();
      authMethod = 'NLAuth';
      console.log('Using NLAuth for Workflow Administrator');
    } catch (error) {
      console.log('NLAuth failed, trying OAuth 1.0:', error.message);
      try {
        // Method 2: Try OAuth 1.0
        authHeader = generateOAuth1Header(netsuiteUrl, req.method);
        authMethod = 'OAuth1';
        console.log('Using OAuth 1.0 for Workflow Administrator');
      } catch (oauthError) {
        console.log('OAuth 1.0 failed, trying Basic Auth:', oauthError.message);
        // Method 3: Fallback to Basic Auth
        authHeader = generateBasicAuth();
        authMethod = 'Basic';
        console.log('Using Basic Auth for Workflow Administrator');
      }
    }
    
    console.log('Proxying to:', netsuiteUrl);
    console.log('Method:', req.method);
    console.log('Auth method:', authMethod);
    console.log('Auth header:', authHeader.substring(0, 50) + '...');
    
    // Make request to NetSuite
    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'NetSuite-WorkflowAdmin-ChatGPT/1.0'
      }
    };
    
    // Add body for POST/PATCH requests
    if (req.method !== 'GET' && req.method !== 'DELETE' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }
    
    const response = await fetch(netsuiteUrl, fetchOptions);
    const responseText = await response.text();
    
    console.log('NetSuite response status:', response.status);
    console.log('NetSuite response:', responseText.substring(0, 200) + '...');
    
    // Try to parse as JSON, fallback to text
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = { text: responseText, status: response.status };
    }
    
    res.status(response.status).json(data);
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Proxy server error',
      message: error.message,
      stack: error.stack
    });
  }
}

// Alternative endpoint for testing
export function config() {
  return {
    api: {
      bodyParser: {
        sizeLimit: '1mb',
      },
    },
  }
}