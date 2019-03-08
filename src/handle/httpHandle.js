const http = require("http");
const https = require("https");
const parseUrl = require("../utils/parseUrl");
const Dns = require("../utils/dns");
const requestResponseUtils = require("../utils/requestResponseUtils");

// request session id seed
let httpHandle;
module.exports = class HttpHandle {
  static getInstance() {
    if (!httpHandle) {
      httpHandle = new HttpHandle();
    }
    return httpHandle;
  }

  constructor() {
    this.dns = new Dns({});
  }

  /**
   * 正常的http请求处理流程，
   * 处理流程 更具转发规则、mock规则
   */
  async handle(req, res) {
    // 解析请求参数
    let urlObj = parseUrl(req);
    let ip = await this.dns.resovleIp(urlObj.hostname);

    if (urlObj.query && urlObj.query.mall_cloud) {
      let toClientResponse = {
        statusCode: 200,
        headers: {}, // 要发送给浏览器的header
        body: "" // 要发送给浏览器的body
      };
      await this.cache({
        req,
        res,
        method: req.method,
        protocol: urlObj.protocol,
        ip,
        hostname: urlObj.hostname,
        path: urlObj.path,
        port: urlObj.port,
        headers: req.headers,
        toClientResponse
      });
    //  toClientResponse.body = toClientResponse.body.toString("utf8");
      console.log(toClientResponse.body)
      toClientResponse.headers['content-length'] = toClientResponse.body.length;
      res.writeHead(toClientResponse.statusCode, toClientResponse.headers);
      res.end("utf8");
    } else {
      this.pipe({
        req,
        res,
        method: req.method,
        protocol: urlObj.protocol,
        ip,
        hostname: urlObj.hostname,
        path: urlObj.path,
        port: urlObj.port,
        headers: req.headers
      });
    }
  }

  /**
   * 将请求远程的响应内容直接返回给浏览器
   */
  async pipe({
    req,
    res,
    method,
    protocol,
    ip,
    hostname,
    path,
    port,
    headers
  }) {
    // http.request 解析dns时，偶尔会出错
    // pipe流 获取远程数据 并做记录
    try {
      let proxyResponsePromise = this._requestServer({
        req,
        ip,
        hostname,
        protocol,
        method,
        port,
        path,
        headers
      });

      let proxyResponse = await proxyResponsePromise;

      res.writeHead(proxyResponse.statusCode, proxyResponse.headers);
      // 向服务器返回发送给浏览器
      proxyResponse.pipe(res);
    } catch (e) {
      console.error(hostname, path, e);
    }
  }

  /**
   * 将请求远程的响应内容
   */
  async cache({
    req,
    method,
    protocol,
    ip,
    hostname,
    path,
    port,
    headers,
    toClientResponse
  }) {
    try {
      let proxyResponsePromise = await this._requestServer({
        req,
        ip,
        hostname,
        protocol,
        method,
        port,
        path,
        headers
      });

      let proxyResponse = await proxyResponsePromise;

      toClientResponse.headers = proxyResponse.headers;

      delete toClientResponse.headers["content-encoding"];
      delete toClientResponse.headers["transfer-encoding"];

      toClientResponse.statusCode = proxyResponse.statusCode;

      let resData = await requestResponseUtils.getServerResponseBody(
        proxyResponse
      );

      toClientResponse.body = resData;
    } catch (e) {
      console.error(hostname, path, e);
    }
  }

  // 请求远程服务器，并将响应流通过promise的方式返回
  _requestServer({
    req,
    protocol,
    method,
    ip,
    hostname,
    port,
    path,
    headers,
    timeout = 10000
  }) {
    let proxyRequestPromise = new Promise((resolve, reject) => {
      let requestPath = path;
      let requestProtocol = protocol;
      let requestPort = port;
      let requestHostname = ip || hostname;

      let client = requestProtocol === "https:" ? https : http;
      let proxyRequest = client.request(
        {
          protocol: requestProtocol,
          method,
          port: requestPort,
          path: requestPath,
          hostname: requestHostname,
          desIp: ip,
          headers,
          timeout,
          rejectUnauthorized: false,
          setHost: false
        },
        proxyResponse => {
          // 有响应时返回promise
          resolve(proxyResponse);
        }
      );
      proxyRequest.on("error", e => {
        reject(e);
      });
      req.pipe(proxyRequest);
    });
    return proxyRequestPromise;
  }
};
