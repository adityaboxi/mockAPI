// bullmq-worker/utils/aiUtils.js
require('../opentelemetry/universal-logger');  // <-- Add this line FIRST
const crypto = require('crypto');

function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  return Object.keys(obj).sort().reduce((sorted, key) => {
    sorted[key] = sortObjectKeys(obj[key]);
    return sorted;
  }, {});
}

function getCacheKey(payload) {
  const sortedPayload = sortObjectKeys(payload);
  const jsonStr = JSON.stringify(sortedPayload);
  const hash = crypto.createHash('md5').update(jsonStr).digest('hex');
  return `ai:response:${hash}`;
}

function generateSampleResponse(userInput) {
  const inputStr = `${userInput?.geminiInput || ''} ${userInput?.urlPath || ''}`.toLowerCase();
  
  // Domain 1: Authentication / User Login / Registration
  if (inputStr.includes('auth') || inputStr.includes('login') || inputStr.includes('signup') || inputStr.includes('register') || inputStr.includes('user')) {
    const isSignup = inputStr.includes('signup') || inputStr.includes('register');
    return {
      protocol: 'https',
      method: 'POST',
      urlPath: isSignup ? '/api/v1/auth/register' : '/api/v1/auth/login',
      pathParams: [],
      queryParams: [],
      requestBody: isSignup ? {
        username: 'alex_developer',
        email: 'alex.dev@example.com',
        password: 'SuperSecretPassword123!',
        fullName: 'Alex Morgan'
      } : {
        email: 'alex.dev@example.com',
        password: 'SuperSecretPassword123!'
      },
      responseBody: {
        status: 'success',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY0ZjEwYTkyIiwiZXhwIjoxNzk5OTk5OTk5fQ.sample_signature',
        user: {
          id: 'usr_98a76bc12f',
          username: 'alex_developer',
          email: 'alex.dev@example.com',
          role: 'developer',
          createdAt: new Date().toISOString()
        }
      },
      isAuthEnabled: false,
      authScheme: 'BearerAuth',
      latency: 120,
      rateLimit: 30,
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      responseHeaders: [{ key: 'X-RateLimit-Remaining', value: '29' }],
      cookies: [],
      expectedToken: '',
      expectedApiKey: '',
      includeAIResponse: false,
      statusCode: isSignup ? 201 : 200,
    };
  }

  // Domain 2: E-Commerce / Orders / Checkout / Payments
  if (inputStr.includes('order') || inputStr.includes('checkout') || inputStr.includes('cart') || inputStr.includes('product') || inputStr.includes('pay') || inputStr.includes('stripe')) {
    return {
      protocol: 'https',
      method: 'POST',
      urlPath: '/api/v1/orders/checkout',
      pathParams: [],
      queryParams: [],
      requestBody: {
        items: [
          { productId: 'prod_901', name: 'Wireless Noise Canceling Headphones', quantity: 1, unitPrice: 199.99 },
          { productId: 'prod_442', name: 'USB-C Fast Charging Cable (2m)', quantity: 2, unitPrice: 14.50 }
        ],
        currency: 'USD',
        shippingAddress: {
          street: '742 Evergreen Terrace',
          city: 'Springfield',
          state: 'OR',
          postalCode: '97477',
          country: 'US'
        },
        paymentMethod: 'pm_card_visa'
      },
      responseBody: {
        orderId: 'ord_2026_883921',
        status: 'confirmed',
        subtotal: 228.99,
        tax: 18.32,
        shipping: 0.00,
        total: 247.31,
        currency: 'USD',
        paymentStatus: 'succeeded',
        estimatedDelivery: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        trackingUrl: 'https://track.mockapi.info/ord_2026_883921'
      },
      isAuthEnabled: true,
      authScheme: 'BearerAuth',
      latency: 180,
      rateLimit: 60,
      headers: [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Authorization', value: 'Bearer eyJhbGciOiJIUzI1Ni...' }
      ],
      responseHeaders: [
        { key: 'X-Order-Status', value: 'processed' }
      ],
      cookies: [],
      expectedToken: 'eyJhbGciOiJIUzI1Ni...',
      expectedApiKey: '',
      includeAIResponse: false,
      statusCode: 201,
    };
  }

  // Domain 3: Analytics / Metrics / Dashboard
  if (inputStr.includes('analytic') || inputStr.includes('metric') || inputStr.includes('stat') || inputStr.includes('report')) {
    return {
      protocol: 'https',
      method: 'GET',
      urlPath: '/api/v1/analytics/overview',
      pathParams: [],
      queryParams: [
        { key: 'range', value: '30d' },
        { key: 'interval', value: 'daily' }
      ],
      requestBody: null,
      responseBody: {
        timeRange: 'last_30_days',
        totalRequests: 1428590,
        averageLatencyMs: 34.8,
        successRatePercentage: 99.94,
        metrics: [
          { date: '2026-08-30', requests: 48200, p95Latency: 52 },
          { date: '2026-08-31', requests: 51300, p95Latency: 49 },
          { date: '2026-09-01', requests: 53100, p95Latency: 46 }
        ]
      },
      isAuthEnabled: true,
      authScheme: 'ApiKeyAuth',
      latency: 90,
      rateLimit: 120,
      headers: [
        { key: 'X-API-Key', value: 'mock_live_sec_key_99482' }
      ],
      responseHeaders: [
        { key: 'Cache-Control', value: 'public, max-age=60' }
      ],
      cookies: [],
      expectedToken: '',
      expectedApiKey: 'mock_live_sec_key_99482',
      includeAIResponse: false,
      statusCode: 200,
    };
  }

  // Default General Purpose REST API Blueprint
  const cleanPath = userInput?.urlPath && userInput.urlPath !== '/' ? userInput.urlPath : '/api/v1/resources';
  return {
    protocol: userInput?.protocol || 'https',
    method: userInput?.method || 'GET',
    urlPath: cleanPath,
    pathParams: Array.isArray(userInput?.pathParams) ? userInput.pathParams : [],
    queryParams: Array.isArray(userInput?.queryParams) ? userInput.queryParams : [],
    requestBody: userInput?.requestBody || (userInput?.method === 'POST' || userInput?.method === 'PUT' ? {
      name: 'Sample Entity',
      description: 'Realistic resource generated by MockAPI AI engine',
      isActive: true,
      metadata: { priority: 'high', tags: ['production', 'mock'] }
    } : null),
    responseBody: userInput?.responseBody || {
      id: 'res_67a89b02f1',
      name: 'Sample Entity',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: {
        count: 1,
        items: [{ id: 1, title: 'Item Alpha', score: 98.6 }]
      }
    },
    isAuthEnabled: userInput?.isAuthEnabled || false,
    authScheme: userInput?.authScheme || 'BearerAuth',
    latency: userInput?.latency || 80,
    rateLimit: userInput?.rateLimit || 60,
    headers: Array.isArray(userInput?.headers) && userInput.headers.length > 0 ? userInput.headers : [{ key: 'Content-Type', value: 'application/json' }],
    responseHeaders: Array.isArray(userInput?.responseHeaders) ? userInput.responseHeaders : [],
    cookies: Array.isArray(userInput?.cookies) ? userInput.cookies : [],
    expectedToken: userInput?.expectedToken || '',
    expectedApiKey: userInput?.expectedApiKey || '',
    includeAIResponse: Boolean(userInput?.includeAIResponse),
    statusCode: userInput?.statusCode || (userInput?.method === 'POST' ? 201 : 200),
  };
}

function buildFinalResponse(aiResponse, userInput) {
  return {
    protocol: aiResponse.protocol ?? userInput.protocol ?? 'https',
    method: aiResponse.method ?? userInput.method ?? 'GET',
    urlPath: aiResponse.urlPath ?? userInput.urlPath ?? '/api/v1/endpoint',
    pathParams: Array.isArray(aiResponse.pathParams) ? aiResponse.pathParams : (userInput.pathParams || []),
    queryParams: Array.isArray(aiResponse.queryParams) ? aiResponse.queryParams : (userInput.queryParams || []),
    requestBody: aiResponse.requestBody !== undefined ? aiResponse.requestBody : (userInput.requestBody || null),
    responseBody: aiResponse.responseBody !== undefined ? aiResponse.responseBody : (userInput.responseBody || null),
    isAuthEnabled: typeof aiResponse.isAuthEnabled === 'boolean' ? aiResponse.isAuthEnabled : Boolean(userInput.isAuthEnabled),
    authScheme: aiResponse.authScheme ?? userInput.authScheme ?? 'BearerAuth',
    latency: typeof aiResponse.latency === 'number' ? aiResponse.latency : (userInput.latency || 0),
    rateLimit: typeof aiResponse.rateLimit === 'number' ? aiResponse.rateLimit : (userInput.rateLimit || 0),
    headers: Array.isArray(aiResponse.headers) ? aiResponse.headers : (userInput.headers || []),
    responseHeaders: Array.isArray(aiResponse.responseHeaders) ? aiResponse.responseHeaders : (userInput.responseHeaders || []),
    cookies: Array.isArray(aiResponse.cookies) ? aiResponse.cookies : (userInput.cookies || []),
    expectedToken: aiResponse.expectedToken ?? userInput.expectedToken ?? '',
    expectedApiKey: aiResponse.expectedApiKey ?? userInput.expectedApiKey ?? '',
    includeAIResponse: typeof aiResponse.includeAIResponse === 'boolean' ? aiResponse.includeAIResponse : Boolean(userInput.includeAIResponse),
    statusCode: typeof aiResponse.statusCode === 'number' ? aiResponse.statusCode : (userInput.statusCode || 200),
  };
}

module.exports = { getCacheKey, buildFinalResponse, generateSampleResponse };