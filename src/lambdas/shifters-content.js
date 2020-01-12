const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  
  const res = await fetch(`https://drive.google.com/uc?id=${process.env.INDEX_JSON_FILE_ID}`);
  const chapters = await res.json();

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin" : "*",
    },
    body: JSON.stringify(chapters),
  };
}