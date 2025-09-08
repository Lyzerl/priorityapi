const https = require('https');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // פרטי חיבור ממשתני סביבה
    const username = process.env.PRIORITY_USERNAME;
    const password = process.env.PRIORITY_PASSWORD;
    
    console.log('Environment check:', {
      hasUsername: !!username,
      hasPassword: !!password,
      usernameLength: username ? username.length : 0
    });
    
    if (!username || !password) {
      console.error('Missing credentials:', { username: !!username, password: !!password });
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'פרטי חיבור לא מוגדרים בשרת - בדוק משתני סביבה',
          details: 'PRIORITY_USERNAME או PRIORITY_PASSWORD לא מוגדרים'
        })
      };
    }

    const { date, action } = JSON.parse(event.body);
    console.log('Request data:', { date, action });
    
    const auth = Buffer.from(username + ':' + password).toString('base64');
    const baseUrl = 'https://p.priority-connect.online/odata/Priority/tabbc66b.ini/a080724/PRIT_ORDPACK_ONE';
    
    let apiUrl = baseUrl;
    if (action === 'getData' && date) {
      apiUrl = baseUrl + '?$filter=DUEDATE%20eq%20' + date + 'T00:00:00Z';
    }

    console.log('Request URL:', apiUrl);
    console.log('Auth header length:', auth.length);
    
    const result = await makeHttpsRequest(apiUrl, auth);
    console.log('Response:', { statusCode: result.statusCode, bodyLength: result.body.length });

    if (result.statusCode === 200) {
      let data = JSON.parse(result.body);
      console.log('Parsed data:', { recordCount: data && data.value ? data.value.length : 0 });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: data,
          recordCount: data && data.value ? data.value.length : 0
        })
      };
    } else {
      console.error('API Error:', { statusCode: result.statusCode, body: result.body });
      return {
        statusCode: result.statusCode,
        headers,
        body: JSON.stringify({ 
          error: 'שגיאה ' + result.statusCode,
          details: result.body
        })
      };
    }

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'שגיאת שרת: ' + error.message,
        stack: error.stack
      })
    };
  }
};

function makeHttpsRequest(url, auth) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Accept': 'application/json',
        'User-Agent': 'Priority-Data-Portal/1.0'
      },
      timeout: 30000
    };

    console.log('Making request to:', urlObj.hostname + urlObj.pathname);

    const req = https.request(options, (res) => {
      let data = '';
      
      console.log('Response status:', res.statusCode);
      console.log('Response headers:', res.headers);
      
      res.on('data', (chunk) => { 
        data += chunk; 
      });
      
      res.on('end', () => {
        console.log('Response completed, data length:', data.length);
        resolve({ statusCode: res.statusCode, body: data });
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.error('Request timeout');
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}
