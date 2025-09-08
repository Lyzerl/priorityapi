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
    const { username, password, date, action } = JSON.parse(event.body);

    if (!username || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'חסרים שם משתמש או סיסמה' })
      };
    }

    const auth = Buffer.from(username + ':' + password).toString('base64');
    const baseUrl = 'https://p.priority-connect.online/odata/Priority/tabbc66b.ini/a080724/PRIT_ORDPACK_ONE';
    
    let apiUrl = baseUrl;
    if (action === 'getData' && date) {
      apiUrl = baseUrl + '?$filter=DUEDATE%20eq%20' + date + 'T00:00:00Z';
    }

    const result = await makeHttpsRequest(apiUrl, auth);

    if (result.statusCode === 200) {
      let data;
      try {
        data = JSON.parse(result.body);
      } catch (parseError) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'תשובה לא תקינה מהשרת' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: data,
          user: username,
          searchDate: date,
          recordCount: data && data.value ? data.value.length : 0
        })
      };
    } else {
      return {
        statusCode: result.statusCode,
        headers,
        body: JSON.stringify({ error: 'שגיאה ' + result.statusCode })
      };
    }

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'שגיאת שרת: ' + error.message
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
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: data
        });
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}
