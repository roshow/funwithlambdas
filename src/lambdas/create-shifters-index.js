const {google} = require('googleapis');
const fetch = require('node-fetch');

// export CHAPTERS_FOLDER_ID='1W6gVK5xU2VTsXDozyskHojMM2nKEM3Sg';
// export INDEX_JSON_FILE_ID='1pQUOmyHJDQWhVEzPt9Etg6MOJpfX1lul';

const listFiles = (drive, config) => new Promise((resolve, reject) => {
  drive.files.list(config, (err, res) => {
    if (err) {
      reject(err);
    } else {
      resolve(res);
    }
  });
});

const getIndexFromName = name => {
  const [, indexStr] = name.match(/^(\d+)\.jp/) || [];
  return parseInt(indexStr, 10);
}

// this is what does all the work

async function indexChapters() {
  // get auth
  const auth = await google.auth.getClient({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  
  // create drive
  const drive = google.drive({version: 'v3', auth});

  // get subfolders in chapters folder
  const res = await listFiles(drive, {
    fields: 'nextPageToken, files(name, id, mimeType)',
    q: `'${process.env.CHAPTERS_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
  });

  const folders = res.data.files;

  // here's where we go into each folder, list the files, an create an object
  // with page IDs, title from title.txt file and the chapter number. As doing all 
  // that requires async operations, this return an array of promises that resolve
  // into an array of chapters
  const promises = folders.map(async (folder) => {
    const res = await listFiles(drive, {
      fields: 'nextPageToken, files(name, id)',
      q: `'${folder.id}' in parents and (mimeType = 'image/jpeg' or name = 'title.txt')`,
    });
  
    const { files } = res.data;
    
    const pages = files.filter(({ name }) => !isNaN(getIndexFromName(name)))
      .sort((a, b) => getIndexFromName(a.name) - getIndexFromName(b.name))
      .map(({ id }) => id)
  
    const { id: titleFileId } = files.find(({ name }) => name === 'title.txt');

    const titleFile = await fetch(`https://drive.google.com/uc?id=${titleFileId}&export=download`);
  
    const titleRaw = await titleFile.text();
  
    title = titleRaw.trim();
    
    return {
      number: parseInt(folder.name),
      title,
      pages,
    };
  
  });
  const chapters = await Promise.all(promises);

  // finally, make sure array of chapters are ordered numerically...
  const chaptersOrdered = chapters.sort((a, b) => a.number - b.number);
  
  // and write to the index.json file:
  return new Promise((resolve, reject) => {
    drive.files.update({
      fileId: process.env.INDEX_JSON_FILE_ID,
      uploadType: 'media',
      media: {
        mimeType: 'application/json',
        body: JSON.stringify(chaptersOrdered),
      }
    }, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

}

exports.handler = async (event) =>{
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    await indexChapters();
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin" : "*",
      },
      body: 'index.json updated'
    }
  } catch (e) {
    console.log('Error with indexChapters:', e);
    return {
      statusCode: 500,
      body: 'Something did not go right on our end I think'
    }
  }
  
};
