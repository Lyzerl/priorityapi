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
    // בדיקת משתני סביבה
    const username = process.env.PRIORITY_USERNAME;
    const password = process.env.PRIORITY_PASSWORD;
    
    console.log('=== DEBUG INFO ===');
    console.log('Username exists:', !!username);
    console.log('Password exists:', !!password);
    
    if (!username || !password) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'פרטי חיבור לא מוגדרים',
          debug: { hasUsername: !!username, hasPassword: !!password }
        })
      };
    }

    const { date, action } = JSON.parse(event.body);
    console.log('Request:', { date, action });
    
    // נסה תחילה בלי פילטר תאריך
    const baseUrl = 'https://p.priority-connect.online/odata/Priority/tabbc66b.ini/a080724/PRIT_ORDPACK_ONE';
    
    let apiUrl = baseUrl;
    
    // רק אם יש תאריך ופעולה מתאימה
    if (action === 'getData' && date) {
      // נסה כמה פורמטים שונים של תאריך
      const dateFormats = [
        `${date}T00:00:00Z`,
        `${date}T00:00:00`,
        `${date}`,
        `datetime'${date}T00:00:00'`
      ];
      
      // נשתמש בפורמט הראשון לבדיקה
      apiUrl = `${baseUrl}?$filter=DUEDATE eq datetime'${date}T00:00:00'`;
    }

    console.log('API URL:', apiUrl);
    
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    console.log('Auth created, length:', auth.length);
    
    // נסה קודם בדיקת connectivity פשוטה
    const result = await makeHttpsRequest(apiUrl, auth);
    
    console.log('Response status:', result.statusCode);
    console.log('Response body preview:', result.body.substring(0, 200));
    
    if (result.statusCode === 200) {
      try {
        const data = JSON.parse(result.body);
        console.log('Successfully parsed JSON');
        console.log('Data keys:', Object.keys(data));
        console.log('Record count:', data.value ? data.value.length : 0);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: data,
            recordCount: data.value ? data.value.length : 0,
            debug: {
              url: apiUrl,
              responseKeys: Object.keys(data)
            }
          })
        };
      } catch (parseError) {
        console.error('JSON Parse error:', parseError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'שגיאה בפרסור התשובה',
            debug: {
              responseBody: result.body.substring(0, 500),
              parseError: parseError.message
            }
          })
        };
      }
    } else if (result.statusCode === 401) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          error: 'שגיאת הרשאה - בדוק שם משתמש וסיסמה',
          debug: { statusCode: result.statusCode }
        })
      };
    } else if (result.statusCode === 404) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: 'לא נמצא - בדוק את כתובת ה-API',
          debug: { 
            statusCode: result.statusCode,
            url: apiUrl,
            responseBody: result.body.substring(0, 200)
          }
        })
      };
    } else {
      return {
        statusCode: result.statusCode,
        headers,
        body: JSON.stringify({ 
          error: `שגיאת שרת ${result.statusCode}`,
          debug: {
            statusCode: result.statusCode,
            responseBody: result.body.substring(0, 500),
            url: apiUrl
          }
        })
      };
    }

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'שגיאת שרת כללית',
        debug: {
          message: error.message,
          stack: error.stack.substring(0, 500)
        }
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
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Priority-Data-Portal/1.0'
      },
      timeout: 15000  // 15 שניות timeout
    };

    console.log('Making request to:', options.hostname + options.path);
    console.log('Headers:', JSON.stringify(options.headers, null, 2));

    const req = https.request(options, (res) => {
      let data = '';
      
      console.log('Response headers:', JSON.stringify(res.headers, null, 2));
      
      res.on('data', (chunk) => { 
        data += chunk; 
      });
      
      res.on('end', () => {
        console.log('Request completed. Data length:', data.length);
        resolve({ 
          statusCode: res.statusCode, 
          body: data,
          headers: res.headers 
        });
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(new Error(`Network error: ${error.message}`));
    });
    
    req.on('timeout', () => {
      console.error('Request timeout');
      req.destroy();
      reject(new Error('Request timeout - הזמן הקצוב עבר'));
    });
    
    req.end();
  });
}
