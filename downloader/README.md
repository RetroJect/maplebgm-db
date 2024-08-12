# Database Downloader

Provides a script to easily download and tag all YouTube releases of the MapleStory BGM database.
Uses [yt-dlp](https://github.com/yt-dlp/yt-dlp) to download each release with a provided YouTube video ID.

Extra option include extracting all tracks as MP3s and tagging them using ID3 tags with title, album, artist, etc.
This option is on by default but can be disabled using environment variables.
See #environment-variables for more details on available parameters.

## Install

Install required packages before running: `npm install`

## Usage

To download tracks from the database run `npm run start` and all tracks will be saved to `../output`.
Tracks are saved into sub-directories based on the name of the database index file they come from.
For instance, the track "Dragon Dream" is downloaded out of `../bgm/Bgm00.json` and saved into `../output/Bgm00/DragonDream.mp3`.

### Environment Variables

| Variable Name | Description | Default |
| ------------- | ----------- | ------- |
| `YT_DLP_PATH` | The path pointing to the directory containing the yt-dlp binary, called binary (or binary.exe on Windows) | `./yt-dlp` |
| `BGM_DB_PATH` | The path to the MapleStory BGM Database root directory | `../bgm` |
| `OUTPUT_PATH` | The path where tracks will be download to and subdirectories will be created | `../output` |
| `MAX_DOWNLOAD` | The maximum number of concurrent downloads | `5` |
| `EXTRACT_AUDIO_AS_MP3` | Allows the downloader to use ffmpeg to convert downloaded tracks to mp3 format. ffmpeg must be available in PATH | `true` |
| `UPDATE_MP3_TAGS` | Updated the ID3 tags on every MP3 downloaded to add info like title and artist. `EXTRACT_AUDIO_AS_MP3` must be enabled for this function. | `true` |
