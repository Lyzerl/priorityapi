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
    console.log('=== DEBUG INFO ===');
    console.log('Function started successfully');

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
    
    console.log('Skipping API call for testing');
    
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

