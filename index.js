const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const { Configuration, OpenAIApi } = require('openai');
const SrtParser = require('srt-parser-2');
const path = require('path');

// Set up OpenAI API
const configuration = new Configuration({
    apiKey: 'YOUR_OPENAI_API_KEY',
});
const openai = new OpenAIApi(configuration);

const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(fileUpload());

// Function to read subtitle file
const readSrtFile = (filePath) => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parser = new SrtParser();
    return parser.fromSrt(fileContent);
};

// Function to translate text using OpenAI API
const translateText = async (text) => {
    const response = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt: `Translate the following English text to Hinglish:\n\n"${text}"\n\nTranslation:`,
        max_tokens: 150,
    });
    return response.data.choices[0].text.trim();
};

// Function to translate subtitles
const translateSubtitles = async (subtitles) => {
    for (const subtitle of subtitles) {
        subtitle.text = await translateText(subtitle.text);
    }
    return subtitles;
};

// Function to write subtitles to file
const writeSrtFile = (subtitles, outputPath) => {
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

        const subtitles = readSrtFile(inputPath);
        const translatedSubtitles = await translateSubtitles(subtitles);
        writeSrtFile(translatedSubtitles, outputPath);

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