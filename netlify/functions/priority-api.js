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

    // בדיקה שהבקשה תקינה
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'בקשה ריקה - אין נתונים בבקשה',
          debug: { hasBody: !!event.body }
        })
      };
    }
    
    let requestData;
    try {
      requestData = JSON.parse(event.body);
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'שגיאה בפרסור הבקשה - JSON לא תקין',
          debug: { parseError: parseError.message }
        })
      };
    }
    
    const { date, action } = requestData;
    console.log('Request:', { date, action });
    
    // בדיקה שהפעולה תקינה
    if (!action || action !== 'getData') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'פעולה לא תקינה - רק getData נתמכת',
          debug: { action: action }
        })
      };
    }
    
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    console.log('Auth created, length:', auth.length);
    
    // נסה תחילה בלי פילטר תאריך לבדיקת חיבור
    const baseUrl = 'https://p.priority-connect.online/odata/Priority/tabbc66b.ini/a080724/PRIT_ORDPACK_ONE';
    
    let apiUrl = baseUrl;
    
    // נסה תחילה בלי פילטר תאריך לבדיקה
    console.log('Using base URL without date filter for testing');
    apiUrl = baseUrl;

    console.log('API URL:', apiUrl);
    
    // בדיקה פשוטה - נחזיר תשובה מוכנה לבדיקה
    console.log('Testing with simple response first...');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          value: [
            {
              ORDNO: 'TEST001',
              CUSTNO: 'CUST001',
              CUSTNAME: 'לקוח בדיקה',
              ORDERDATE: date || '2025-01-08',
              STATUS: 'פעיל',
              TOTPRICE: 1000,
              PARTNAME: 'מוצר בדיקה',
              TQUANT: 1
            }
          ]
        },
        recordCount: 1,
        debug: {
          message: 'בדיקה - תשובה מוכנה',
          url: apiUrl,
          date: date,
          action: action,
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    console.error('Error stack:', error.stack);
    
    // טיפול מיוחד בשגיאות שונות
    let errorMessage = 'שגיאת שרת כללית';
    let statusCode = 500;
    
    if (error.message.includes('timeout')) {
      errorMessage = 'שגיאת timeout - השרת לא מגיב בזמן הקצוב';
      statusCode = 504;
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      errorMessage = 'שגיאת חיבור - לא ניתן להתחבר לשרת Priority';
      statusCode = 503;
    } else if (error.message.includes('Unexpected token') || error.message.includes('JSON')) {
      errorMessage = 'שגיאה בפרסור התשובה מהשרת';
      statusCode = 502;
    }
    
    return {
      statusCode: statusCode,
      headers,
      body: JSON.stringify({ 
        error: errorMessage,
        debug: {
          message: error.message,
          stack: error.stack ? error.stack.substring(0, 500) : 'No stack trace',
          timestamp: new Date().toISOString()
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
      timeout: 8000   // 8 שניות timeout (Netlify מוגבל ל-10 שניות)
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
      console.error('Request timeout after 8 seconds');
      req.destroy();
      reject(new Error('Request timeout - הזמן הקצוב עבר (8 שניות)'));
    });
    
    req.end();
  });
}
