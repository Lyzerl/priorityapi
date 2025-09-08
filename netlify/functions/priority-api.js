const https = require('https');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
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
      const filter = encodeURIComponent('DUEDATE eq ' + date + 'T00:00:00Z');
      apiUrl = baseUrl + '?$filter=' + filter;
    }

    const result = await makeHttpsRequest(apiUrl, auth);

    if (result.statusCode === 200) {
      const data = JSON.parse(result.body);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: data,
          user: username,
          searchDate: date,
          recordCount: data.value ? data.value.length : 0
        })
      };
    } else {
      let errorMessage = 'שגיאה ' + result.statusCode;
      try {
        const errorData = JSON.parse(result.body);
        if (errorData.error && errorData.error.message) {
          errorMessage = errorData.error.message;
        }
      } catch (e) {
        errorMessage = 'שגיאה ' + result.statusCode;
      }

      return {
        statusCode: result.statusCode,
        headers,
        body: JSON.stringify({ error: errorMessage })
      };
    }

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'שגיאת שרת פנימית: ' + error.message 
      })
    };
  }
};

function makeHttpsRequest(url, auth) {
  r
