const {google} = require('googleapis');
const fetch = require('node-fetch');

// export CHAPTERS_FOLDER_ID='1W6gVK5xU2VTsXDozyskHojMM2nKEM3Sg';
// export INDEX_JSON_FILE_ID='1pQUOmyHJDQWhVEzPt9Etg6MOJpfX1lul';

let oAuth;
let googleDrive;


const getAuth = async () => {
  if (oAuth) {
    return oAuth;
  }
  oAuth = await google.auth.getClient({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return oAuth;
}

async function getDrive() {
  if (googleDrive) {
    return googleDrive;
  } 
  const auth = await getAuth();
  googleDrive = google.drive({version: 'v3', auth});
  return googleDrive;
}

async function listFiles (config) {
  const drive = await getDrive();
  return new Promise((resolve, reject) => {
    drive.files.list(config, (err, res) => {
      if (err) {
        console.log('The API returned an error: ' + err);
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}

const getIndexFromName = name => {
  const [, indexStr] = name.match(/^(\d+)\.jp/) || [];
  return parseInt(indexStr, 10);
}

const getChapterPageIds = files => (
  files
    .filter(({ name }) => !isNaN(getIndexFromName(name)))
    .sort((a, b) => getIndexFromName(a.name) - getIndexFromName(b.name))
    .map(({id}) => id)
);

async function getChapterTitle (files) {
  const { id: titleFileId } = files.find(({ name }) => name === 'title.txt');

  const titleFile = await fetch(`https://drive.google.com/uc?id=${titleFileId}&export=download`);

  const title = await titleFile.text();

  return title.trim();
}

async function getChapterDetails({ name, id }) {
  const res = await listFiles({
    fields: 'nextPageToken, files(name, id)',
    q: `'${id}' in parents and (mimeType = 'image/jpeg' or name = 'title.txt')`,
  });

  const { files } = res.data;
  
  const pages = getChapterPageIds(files);

  const title = await getChapterTitle(files);
  
  return {
    number: parseInt(name),
    title: title.trim(),
    pages,
  };

}

async function updateIndexJsonFile(content) {
  const drive = await getDrive();
  return new Promise((resolve, reject) => {
    drive.files.update({
      fileId: process.env.INDEX_JSON_FILE_ID,
      uploadType: 'media',
      media: {
        mimeType: 'application/json',
        body: JSON.stringify(content, null, 2),
      }
    }, function (err) {
      if (err) {
        console.log('The API returned an error: ' + err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
  
}

async function indexChapters() {
  const res = await listFiles({
    fields: 'nextPageToken, files(name, id, mimeType)',
    q: `'${process.env.CHAPTERS_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
  });
  const folders = res.data.files;
  const promises = folders.map(getChapterDetails);
  const chapters = await Promise.all(promises);
  const chaptersOrdered = chapters.sort((a, b) => a.number - b.number);
  await updateIndexJsonFile(chaptersOrdered);
  
}

exports.handler = async (event) =>{
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    await indexChapters();
    return {
      statusCode: 201,
      body: 'index.json updated'
    }
  } catch (e) {
    return {
      statusCode: 500,
      body: 'Something did not go right on our end I think'
    }
  }
  
};

// https://drive.google.com/uc?id=19zYMucswfPou8meVcKtS__n4URnFhWvG