const YTDlpWrap = require('yt-dlp-wrap').default;
const MP3Tag = require('mp3tag.js');
const path = require('path');
const fs = require('fs');
const { platform } = require('os');

// Extract environment variables and set defaults
const {
  YT_DLP_PATH = './yt-dlp',
  BGM_DB_PATH = '../bgm',
  OUTPUT_PATH = '../output',
  MAX_DOWNLOAD = 5,
  EXTRACT_AUDIO_AS_MP3 = true,
  UPDATE_MP3_TAGS = true,
} = process.env;

const YOUTUBE_BASE_URL = 'https://www.youtube.com/watch?v=';
const extractAudioFlags = [
  '-x',
  '--audio-format',
  'mp3',
];

const setupDLP = async () => {
  const downloadDir = path.resolve(YT_DLP_PATH);

  // Creates download directory if not present
  await fs.promises.mkdir(downloadDir, { recursive: true });

  // Save binary with .exe if windows platform
  const downloadPath = path.join(downloadDir, `binary${platform() == 'win32' ? '.exe' : ''}`);

  if (fs.existsSync(downloadPath)) {
    console.log(`YT-DLP found at ${downloadPath}, skipping download!`);
  } else {
    console.log(`Downloading latest YT-DLP binary to ${downloadDir}`);

    // Downloads latest version for machine os to ./yt-dlp/
    await YTDlpWrap.downloadFromGithub(downloadPath);

    console.log('YT-DLP download finished!')
  }

  return new YTDlpWrap(downloadPath);
};

const readDatabaseEntry = async (file) => {
  const filePath = path.join(file.parentPath, file.name);

  const fileContents = JSON.parse(await fs.promises.readFile(filePath, { encoding: 'utf-8' }));

  // Map the database file info into each entry and
  // filters out entries without YouTube IDs
  return fileContents
    .filter((entry) => !!entry.youtube)
    .map((entry) => ({
    ...entry,
    databaseFile: file,
  }));
};

const downloadEntry = async (downloader, file) => {
  const databaseFileName = file.databaseFile.name.replace('.json', '');
  // Creates output path like ./output/Bgm00/
  const outputDir = path.resolve(path.join(OUTPUT_PATH, databaseFileName));

  // Remove all non-word characters from filename
  const fileName = file.filename.replaceAll(/\W/g, '');

  // console.log(`Creating output directory for ${file.databaseFile.name}: ${outputDir}`);
  await fs.promises.mkdir(outputDir,{ recursive: true });

  console.log(`Downloading track "${path.join(databaseFileName, fileName)}"`);

  // Executes the yt-dlp binary and extracts as MP3 if requested
  const stdout = await downloader.execPromise([
    `${YOUTUBE_BASE_URL}${file.youtube}`,
    '-f',
    'bestaudio',
    ...(EXTRACT_AUDIO_AS_MP3 ? extractAudioFlags : []),
    '-P',
    outputDir,
    '-P',
    `temp:${path.resolve(path.join(OUTPUT_PATH, 'tmp'))}`,
    '-o',
    fileName,
  ]);

  console.log(`Downloaded track: ${path.join(databaseFileName, fileName)}`)

  // Populate MP3 Tags
  if (EXTRACT_AUDIO_AS_MP3 && UPDATE_MP3_TAGS) {
    console.log(`Updating MP3Tags on ${fileName}.mp3`)

    const outputFilePath = path.join(outputDir, `${fileName}.mp3`);

    const mp3File = await fs.promises.readFile(outputFilePath);
    const mp3tag = new MP3Tag(mp3File);
    mp3tag.read();

    mp3tag.tags.title = file.metadata.title;
    mp3tag.tags.artist = file.metadata.artist;
    mp3tag.tags.album = 'MapleStory';
    mp3tag.tags.year = file.metadata.year;
    mp3tag.tags.comment = file.description;

    // Add ID3v2 tag for Album Artist
    // This tag helps music applications group all songs into a single album
    mp3tag.tags.v2.TPE2 = 'Nexon Co., Ltd.';

    // Update the tags
    mp3tag.save();

    if (mp3tag.error !== '') console.error(`Couldn't save MP3 Tag data for ${fileName}: ${mp3tag.error}`);

    // Read the modified buffer
    mp3tag.read();

    // Write the modified file buffer
    await fs.promises.writeFile(outputFilePath, mp3tag.buffer);
  } else if (UPDATE_MP3_TAGS && !EXTRACT_AUDIO_AS_MP3) {
    console.log("WARNING: Can't update MP3 tags unless tracks are downloaded as MP3 using EXTRACT_AUDIO_AS_MP3!");
  }
};

const main = async () => {
  // do a funky import cause ES Modules are gross and I don't like them
  const Queue = (await import('queue')).default;

  console.log('Syncing MapleStory BGM Database!');

  const downloaderPromise = setupDLP();

  // Read the database recursively
  const databasePromise = fs.promises.readdir(
    path.normalize(BGM_DB_PATH),
    { recursive: true, withFileTypes: true }
  );

  // Wait for yt-dlp download and database reads
  const initResults = await Promise.allSettled([downloaderPromise, databasePromise]);

  // Check for errors initializing
  const initFailures = initResults.filter((result) => result.status == 'rejected');
  if (initFailures.length > 0) {
    console.error('ERROR: Failed to initialize!');
    initFailures.forEach((result) => console.error(result.reason))
    exit(1);
  }

  console.log('Initialization completed, starting downloads!');

  // Extract from promises
  const downloader = await downloaderPromise;
  const database = await databasePromise;

  // Filter out only JSON files
  const jsonEntries = database.filter((entry) => !entry.isDirectory() && entry.name.includes('.json'));

  const databasePromises = jsonEntries.map(readDatabaseEntry);

  let tracks;

  try {
    // Collect all track metadata from all database files
    tracks = (await Promise.all(databasePromises)).flat();
  } catch (error) {
    console.error('ERROR: Unable to read database file!', error);
    exit(1);
  }

  const downloadQueue = new Queue({ concurrency: MAX_DOWNLOAD, autostart: false });

  const downloadFunctions = tracks.map((track) => (() => downloadEntry(downloader, track)));
  // downloadFunctions[0]();

  downloadQueue.push(...downloadFunctions);
  downloadQueue.start((error) => {
    if (error) console.error(`Queue finished with errors: ${error}`);

    // Remove temp directory when finished
    fs.rmdirSync(path.resolve(path.join(OUTPUT_PATH, 'tmp')), { force: true });
  });
};

main();
