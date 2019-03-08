#!/usr/bin/env node
const Launcher = require('./src/launcher');

process.on("SIGINT", function () {
    process.exit();
});
process.on("uncaughtException", function (err) {
    console.error(err);
});
process.on('unhandledRejection', (reason, p) => {
    console.error("Unhandled Rejection at: Promise ", p, " reason: ", reason);
});

// 启动
async function start() {

    // 启动开发代理服务器
    let proxyPort = 8001;

    let launcher = new Launcher(proxyPort);
    launcher.start();
}

start();




