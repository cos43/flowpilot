const config = require('./config');
const proc = require('./proc');
const utils = require('./utils');
(async () => {
    while (true) {
        try {
            const status = proc.checkProcessStatus(config.processName, config.walletID);
            if (status !== 1) {
                if (status === 2) { proc.killProcess(config.processName); await utils.sleep(1000); }
                proc.startProcess(config.binaryPath, config.launchArgs);
            }
            await utils.sleep(10000);
        } catch (error) { await utils.sleep(10000); }
    }
})();