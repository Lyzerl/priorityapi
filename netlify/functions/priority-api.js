// netlify/functions/priority-api.js
const https = require('https');

exports.handler = async (event, context) => {
  // הגדרת CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // טיפול בבקשות OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // רק POST requests מותרים
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('Function called with body:', event.body);
    
    // קריאת הנתונים מהבקשה
    const { username, password, date, action } = JSON.parse(event.body);

    if (!username || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'חסרים שם משתמש או סיסמה' })
      };
    }

    // יצירת Basic Auth
    const auth = Buffer.from(username + ':' + password).toString('base64');
    
    // הגדרת URL
    const baseUrl = 'https://p.priority-connect.online/odata/Priority/tabbc66b.ini/a080724/PRIT_ORDPACK_ONE';
    let apiUrl = baseUrl;
    
    // אם זה בקשה לנתונים עם תאריך
    if (action === 'getData' && date) {
      const filter = encodeURIComponent('DUEDATE eq ' + date + 'T00:00:00Z');
      apiUrl = baseUrl + '?$filter=' + filter;
    }

    console.log('Making request to:', apiUrl);
    console.log('User:', username, 'Action:', action);

    // ביצוע הבקשה ל-Priority API
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
      // טיפול בשגיאות מ-Priority
      let errorMessage = 'שגיאה ' + result.statusCode;
      
      try {
        const errorData = JSON.parse(result.body);
        if (errorData.error && errorData.error.message) {
          errorMessage = errorData.error.message;
        }
      } catch (e) {
        errorMessage = 'שגיאה ' + result.statusCode + ': ' + result.statusText;
      }

      return {
        statusCode: result.statusCode,
        headers,
        body: JSON.stringify({ error: errorMessage })
      };
    }

  } catch (error) {
    console.error('Function error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'שגיאת שרת פנימית: ' + error.message 
      })
    };
  }
};

// פונקציה עזר לביצוע בקשות HTTPS
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
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          statusText: res.statusMessage,
          body: data
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}
