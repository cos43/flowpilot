const fs = require('fs');
const path = require('path');
const https = require('https');
const JSZip = require('jszip');

const DRAWIO_VERSION = 'v24.7.17';
const TARGET_DIR = path.join(__dirname, '../public/drawio');
// Using a reliable mirror for China access (ghproxy.net is often faster)
const MIRRORS = [
    `https://ghproxy.net/https://github.com/jgraph/drawio/releases/download/${DRAWIO_VERSION}/draw.war`,
    `https://mirror.ghproxy.com/https://github.com/jgraph/drawio/releases/download/${DRAWIO_VERSION}/draw.war`,
    `https://github.com/jgraph/drawio/releases/download/${DRAWIO_VERSION}/draw.war`
];

async function downloadFile(url) {
    console.log(`Downloading from: ${url}`);
    return new Promise((resolve, reject) => {
        const req = https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadFile(response.headers.location).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }

            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloadedSize = 0;
            const data = [];
            let lastLogTime = 0;

            response.on('data', (chunk) => {
                data.push(chunk);
                downloadedSize += chunk.length;

                // Log progress every 1 second
                const now = Date.now();
                if (now - lastLogTime > 1000) {
                    const progress = totalSize ? Math.round((downloadedSize / totalSize) * 100) : 0;
                    const mb = (downloadedSize / 1024 / 1024).toFixed(2);
                    process.stdout.write(`\r⬇️  Progress: ${progress}% (${mb} MB)`);
                    lastLogTime = now;
                }
            });

            response.on('end', () => {
                process.stdout.write('\n'); // New line after download
                resolve(Buffer.concat(data));
            });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Download timeout'));
        });
    });
}

async function downloadWithFallbacks() {
    for (const url of MIRRORS) {
        try {
            return await downloadFile(url);
        } catch (e) {
            console.warn(`\n⚠️ Failed to download from ${url}: ${e.message}`);
            console.log('Trying next mirror...');
        }
    }
    throw new Error('All download mirrors failed');
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
        const buffer = await downloadWithFallbacks();

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
