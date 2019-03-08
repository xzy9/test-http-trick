const https = require("https");
const tls = require("tls");
const crypto = require("crypto");
const HttpHandle = require("./handle/httpHandle");

let createSecureContext = tls.createSecureContext || crypto.createSecureContext;

/**
 * 1、转发https请求
 * 2、转发wss请求
 */
module.exports = class HttpsServer {
    constructor(httpsPort, certificationService) {
        this.httpsPort = httpsPort;
        this.httpHandle = HttpHandle.getInstance();
        this.certificationService = certificationService;
    }

    async start() {
        let certification =
            await this.certificationService.getCertificationForHost('internal_https_server');
        // https://support.comodo.com/index.php?/Knowledgebase/Article/View/1120/38/what-is-sni-and-how-it-works
        this.httpsProxyServer = https.createServer({
            SNICallback: this.SNIPrepareCert.bind(this),
            key: certification.key,
            cert: certification.cert
        });
        // 事件监听函数的this指针会被改变
        let that = this;

        this.httpsProxyServer.on('request', (req, res) => {
            that.httpHandle.handle(req, res).catch(e => {
                console.error(e);
            });

        });
        this.httpsProxyServer.on('error', function (err) {
            console.log(err);
            process.exit(0);
        });
        this.httpsProxyServer.listen(this.httpsPort, "0.0.0.0");
    }

    SNIPrepareCert(serverName, SNICallback) {
        this.certificationService.getCertificationForHost(serverName)
            .then(function ({ cert, key }) {
                let ctx = createSecureContext({
                    key: key,
                    cert: cert
                });
                SNICallback(null, ctx);
            });
    }
};
