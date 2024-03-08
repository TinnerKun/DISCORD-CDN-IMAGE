import 'dotenv/config.js';
import express from 'express';
import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';

// express
const app = express();

// public
app.use(express.static('public'));
app.use('/public', express.static('public'));

// body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// cors
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});


app.get('/', (req, res) => {
    res.send('Bypass Discord CDN');
});

app.get('/cdn', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) {
            return res.status(400).send('URL parameter is required');
        }
        const channelId = url.split('/')[5];
        const messageId = url.split('/')[6];

        const response = await axios.get(`https://discord.com/api/v9/channels/${channelId}/messages`, {
            headers: {
                'Authorization': 'Bot ' + process.env.DISCORD_BOT_TOKEN,
            }
        });

        const message = response.data.find((message) => message.id === messageId);
        if (!message) {
            return res.status(404).send('Message not found');
        }

        const attachment = message.attachments[0];
        if (!attachment) {
            return res.status(404).send('Attachment not found');
        }

        const attachmentUrl = attachment.url;
        const contentType = attachment.content_type;

        if (contentType.includes('image')) {
            const imageResponse = await axios.get(attachmentUrl, {
                responseType: 'stream',
            });

            res.header('Content-Type', contentType);
            imageResponse.data.pipe(res);
        } else {
            res.send('Not an image');
        }
    } catch (error) {
        res.status(500).send('An error occurred');
    }
});

app.get('/upload', async (req, res) => {


    res.header('Content-Type', 'text/html');
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Image Upload</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            /* Additional custom styles can be added here */
        </style>
    </head>
    <body class="bg-gray-900 text-gray-100 min-h-screen flex flex-col justify-center items-center">
        <div class="w-full max-w-md p-8 space-y-4 bg-gray-800 rounded-xl shadow-lg">
            <h2 class="text-2xl font-bold text-center">Upload Image</h2>
            <form id="uploadForm" action="/upload" method="post" enctype="multipart/form-data" class="space-y-4">
                <div class="flex flex-col">
                    <label for="image" class="mb-2 text-sm font-medium">Select Image</label>
                    <input type="file" id="image" name="image" accept="image/*" class="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600">
                </div>
                <button type="submit" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 rounded-lg transition-colors duration-150">Upload</button>
            </form>
            <div id="imageUrl" class="text-green-500 hidden">
                <p id="urlText" class="break-words"></p>
                <button id="copyButton" class="mt-2 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-lg transition-colors duration-150">Copy URL</button>
            </div>
        </div>
    
        <script>
            document.getElementById('uploadForm').addEventListener('submit', function(event) {
                event.preventDefault(); // Prevent the default form submission
                const formData = new FormData(this);
                fetch('/upload', {
                    method: 'POST',
                    body: formData,
                })
                .then(response => response.json())
                .then(data => {
                    const imageUrlDiv = document.getElementById('imageUrl');
                    const urlText = document.getElementById('urlText');
                    urlText.innerText = 'URL: http://localhost:3000/cdn?url=https://discord.com/channels/' + data.guild_id + '/' + data.channel_id + '/' + data.id;
                    imageUrlDiv.classList.remove('hidden'); // Show the URL and copy button
                })
                .catch(error => console.error('Error:', error));
            });
    
            document.getElementById('copyButton').addEventListener('click', function() {
                const urlText = document.getElementById('urlText').innerText.replace('URL: ', '');
                navigator.clipboard.writeText(urlText).then(() => {
                    alert('URL copied to clipboard!');
                }).catch(err => {
                    console.error('Error in copying text: ', err);
                });
            });
        </script>
    </body>
    </html>    
    `);
});




app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        const image = req.file;

        if (!image) {
            return res.status(400).send('Image is required');
        }

        const formData = new FormData();
        formData.append('file', image.buffer, image.originalname);
        formData.append('content', new Date().toISOString());

        let response = await axios.post(`https://discord.com/api/v9/channels/${process.env.CHANNEL_ID}/messages`, formData, {
            headers: {
                'Authorization': 'Bot ' + process.env.DISCORD_BOT_TOKEN,
                ...formData.getHeaders(), 
            }
        });

        response.data.guild_id = process.env.GUILD_ID;
        response.data.channel_id = process.env.CHANNEL_ID;

        res.send(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred');
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
