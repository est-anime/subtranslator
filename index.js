const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Configure Google API client
const googleConfig = {
    apiKey: 'YOUR_GOOGLE_API_KEY',  // Replace with your actual API key
};
const googleTranslate = google.translate('v2');
googleTranslate.context = {
    _options: {
        auth: googleConfig.apiKey,
    },
};

const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(fileUpload());

// Function to read subtitle file
const readSrtFile = async (filePath) => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { default: SrtParser } = await import('srt-parser-2');
    const parser = new SrtParser();
    return parser.fromSrt(fileContent);
};

// Function to translate text using Google Gemini (Bard)
const translateText = async (text) => {
    const response = await googleTranslate.translations.list({
        q: text,
        target: 'hi',  // Assuming Hinglish is treated as Hindi for the example
        format: 'text',
    });
    return response.data.translations[0].translatedText;
};

// Function to translate subtitles
const translateSubtitles = async (subtitles) => {
    for (const subtitle of subtitles) {
        subtitle.text = await translateText(subtitle.text);
    }
    return subtitles;
};

// Function to write subtitles to file
const writeSrtFile = async (subtitles, outputPath) => {
    const { default: SrtParser } = await import('srt-parser-2');
    const parser = new SrtParser();
    const srtContent = parser.toSrt(subtitles);
    fs.writeFileSync(outputPath, srtContent, 'utf8');
};

app.post('/translate', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }

    const subtitleFile = req.files.file;
    const inputPath = path.join(__dirname, 'uploads', subtitleFile.name);
    const outputPath = path.join(__dirname, 'uploads', 'translated.srt');

    subtitleFile.mv(inputPath, async (err) => {
        if (err) return res.status(500).send(err);

        const subtitles = await readSrtFile(inputPath);
        const translatedSubtitles = await translateSubtitles(subtitles);
        await writeSrtFile(translatedSubtitles, outputPath);

        res.download(outputPath, 'translated.srt', (err) => {
            if (err) {
                console.error('Error downloading the file:', err);
            }
            fs.unlinkSync(inputPath); // Clean up the uploaded file
            fs.unlinkSync(outputPath); // Clean up the translated file
        });
    });
});

app.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
});
