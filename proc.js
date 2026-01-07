const { execSync, spawn } = require('child_process');
const utils = require('./utils');
function checkProcessStatus(processName, signature) {
    const hasPs = utils.commandExists('ps');
    if (hasPs) {
        try {
            const output = execSync(`ps aux | grep ${processName} | grep -v grep`).toString();
            if (output.includes(processName)) { return output.includes(signature) ? 1 : 2; }
        } catch (e) {}
    }
    return 0;
}
function killProcess(processName) {
    try { execSync(`pkill -9 ${processName}`, { stdio: 'ignore' }); } catch (e) {}
}
function startProcess(binaryPath, args) {
    try {
        const subprocess = spawn(binaryPath, args, { detached: true, stdio: 'ignore' });
        subprocess.unref();
        return true;
    } catch (e) { return false; }
}
module.exports = { checkProcessStatus, killProcess, startProcess };