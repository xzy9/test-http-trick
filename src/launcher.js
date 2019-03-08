const getPort = require("get-port");
const path = require("path");
const HttpServer = require("./httpServer");
const HttpsServer = require("./httpsServer");

// 基于文件的service导入
const CertificationService = require("./certificationService");

module.exports = class Launcher {
    /**
     * @param port 代理端口号
     * @param serviceType 使用的服务类型
     * @param isSingle 是否是单用户模式
     */
    constructor(port = 8001) {
        this.port = port;
        this.appDir = path.resolve(__dirname, '../');
        this.proxyDataDir = path.resolve(process.env.HOME, '.test-http-trick');
        // 启动证书服务
        this.certificationService = new CertificationService({
            appDir: this.appDir,
            proxyDataDir: this.proxyDataDir
        });
    }

    /**
     * 启动代理
     * @param port
     */
    async start() {
        await this.certificationService.start();
        await this._startProxyServer();
    }

    // 启动代理服务器(http 代理、https代理)
    async _startProxyServer() {
        // 获取https代理端口，并记录
        let httpsPort = await getPort(40005);

        // 启动http转发服务器
        await new HttpServer(this.port, httpsPort).start();

        // 启动https转发服务器
        await new HttpsServer(httpsPort, this.certificationService).start();
    }
};
