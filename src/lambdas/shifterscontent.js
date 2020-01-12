const fetch = require('node-fetch');

exports.handler = async () => {
  const res = await fetch('https://drive.google.com/uc?id=1pQUOmyHJDQWhVEzPt9Etg6MOJpfX1lul');
  const chapters = await res.json();

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin" : "*",
    },
    body: JSON.stringify(chapters),
  };
}