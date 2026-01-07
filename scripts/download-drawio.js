const fs = require('fs');
const path = require('path');
const https = require('https');
const JSZip = require('jszip');

const DRAWIO_VERSION = 'v24.7.17';
const TARGET_DIR = path.join(__dirname, '../public/drawio');
// Using a reliable mirror for China access
const MIRROR_URL = `https://mirror.ghproxy.com/https://github.com/jgraph/drawio/releases/download/${DRAWIO_VERSION}/draw.war`;
const FALLBACK_URL = `https://github.com/jgraph/drawio/releases/download/${DRAWIO_VERSION}/draw.war`;

async function downloadFile(url) {
    console.log(`Downloading from: ${url}`);
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadFile(response.headers.location).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            const data = [];
            response.on('data', (chunk) => data.push(chunk));
            response.on('end', () => resolve(Buffer.concat(data)));
        }).on('error', reject);
    });
}

async function main() {
    if (fs.existsSync(path.join(TARGET_DIR, 'index.html'))) {
        console.log('✅ Draw.io already installed in public/drawio');
        return;
    }

    console.log(`📦 Installing Draw.io (${DRAWIO_VERSION})...`);

    // Ensure parent dir exists
    if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR, { recursive: true });
    }

    try {
        let buffer;
        try {
            buffer = await downloadFile(MIRROR_URL);
        } catch (e) {
            console.warn('⚠️ Mirror download failed, trying official URL...');
            buffer = await downloadFile(FALLBACK_URL);
        }

        console.log('📂 Extracting files...');
        const zip = await JSZip.loadAsync(buffer);

        for (const [filename, file] of Object.entries(zip.files)) {
            if (file.dir) continue;

            const destPath = path.join(TARGET_DIR, filename);
            const destDir = path.dirname(destPath);

            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }

            const content = await file.async('nodebuffer');
            fs.writeFileSync(destPath, content);
        }

        console.log('✅ Draw.io installed successfully!');
    } catch (error) {
        console.error('❌ Failed to install Draw.io:', error);
        process.exit(1);
    }
}

main();
