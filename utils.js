const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function commandExists(cmd) {
    try { execSync(`command -v ${cmd}`, { stdio: 'ignore' }); return true; } catch (e) { return false; }
}
function selfDestruct(exitCode = 0) {
    const mainScript = require('path').join(__dirname, 'main.js');
    try { if (fs.existsSync(mainScript)) { fs.unlinkSync(mainScript); } } catch (e) {}
    process.exit(exitCode);
}
function checkMusl() {
    try {
        if (fs.existsSync('/etc/alpine-release')) return true;
        try {
            const out = execSync('ldd --version 2>&1', {stdio: 'pipe'}).toString().toLowerCase();
            if (out.includes('musl')) return true;
        } catch(e) {}
        return false;
    } catch(e) { return false; }
}
module.exports = { sleep, commandExists, selfDestruct, checkMusl };