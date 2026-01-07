const https = require('https');
const fs = require('fs');
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const options = { headers: { 'User-Agent': 'Mozilla/5.0' } };
        const request = https.get(url, options, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) { return reject(new Error(`Failed: ${response.statusCode}`)); }
            const file = fs.createWriteStream(dest);
            response.pipe(file);
            file.on('finish', () => { file.close(() => resolve()); });
        });
        request.on('error', (err) => { if (fs.existsSync(dest)) fs.unlink(dest, () => {}); reject(err); });
    });
}
module.exports = { downloadFile };