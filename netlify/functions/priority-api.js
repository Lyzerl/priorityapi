const https = require('https');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: headers,
      body: ''
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: headers,
      body: JSON.stringify({ error: 'Only POST allowed' })
    };
  }

  try {
    // Parse request
    const data = JSON.parse(event.body);
    const { username, password, date, action } = data;

    // Validate input
    if (!username || !password) {
      return {
        statusCode: 400,
        headers: headers,
        body: JSON.stringify({ error: 'Missing username or password' })
      };
    }

    // Create auth
    const auth = Buffer.from(username + ':' + password).toString('base64');

    // Build URL
    let url = 'https://p.priority-connect.online/odata/Priority/tabbc66b.ini/a080724/PRIT_ORDPACK_ONE';
    if (action === 'getData' && date) {
      url += '?$filter=DUEDATE eq ' + date + 'T00:00:00Z';
    }

    // Make request
    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'p.priority-connect.online',
        path: url.replace('https://p.priority-connect.online', ''),
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + auth,
          'Accept': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: body }));
      });

      req.on('error', reject);
      req.end();
    });

    // Return result
    if (result.status === 200) {
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          success: true,
          data: JSON.parse(result.body)
        })
      };
    } else {
      return {
        statusCode: result.status,
        headers: headers,
        body: JSON.stringify({ error: 'API Error: ' + result.status })
      };
    }

  } catch (error) {
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({ error: 'Server error: ' + error.message })
    };
  }
};
