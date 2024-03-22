const { randomUUID } = require("crypto");
const http = require("http");
const puppeteer = require("puppeteer");
const { join } = require("path");
const { watch, rename, createReadStream } = require("fs");
const { createLogger, format, transports } = require("winston");

let client = null;
let logger = null;

/**
 * @description 启动浏览器
 * @returns {Promise<puppeteer.Browser>}
 */
const browser = async () => {
  return await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
    userDataDir: join(__dirname, "userData"),
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
  });
};

/**
 * @description 下载文件
 * @param {*} client 浏览器实例
 * @param {*} data_total 数据
 * @param {*} page_url 页面地址
 * @returns
 */
const downloadFile = async (client, data_total, page_url) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (data_total) {
        data_total = JSON.parse(data_total);
        const page = await client.newPage();
        await page.goto(
          `${page_url}/#background=${data_total.background}&darkMode=${data_total.darkMode}&theme=${data_total.theme}&padding=${data_total.padding}&code=${data_total.code}`
        );

        // wait 0.5s
        await page.waitForTimeout(500);

        // xpath handler
        const xpathHandler = await page.$x(
          "/html/body/div/div/div[3]/div[6]/button[1]"
        );
        // click xpath
        await xpathHandler[0].click();

        // wait for download
        const watcher = watch("./downloads/pics", async (event, filename) => {
          if (event === "rename" && filename.endsWith(".png")) {
            logger.info("文件下载完成");
            resolve();
            watcher.close();
            await page.close();
          }
        });
      }
    } catch (error) {
      logger.error(error);
      reject(error);
      return;
    }
  });
};

/**
 * @description 将文件流返回给客户端
 * @param {*} res
 */
const pipeFile = async (res) => {
  res.writeHead(200, {
    "Content-Type": "octet-stream",
    "Content-Disposition": "attachment; filename=ray-so-export.png",
  });
  const readStream = createReadStream(
    join(__dirname, "downloads", "pics", "ray-so-export.png")
  );
  // 将文件流返回给客户端
  await readStream.pipe(res);
  res.on("close", () => {
    readStream.destroy();
    rename(
      join(__dirname, "downloads", "pics", "ray-so-export.png"),
      join(__dirname, "downloads", "pics", randomUUID()),
      (err) => {
        if (err) {
          logger.error(err);
        }
      }
    );
  });
};

/**
 * @description 创建服务器
 */
const server = http.createServer(async (req, res) => {
  const page_url = "http://192.168.5.145";
  logger.info("接收到请求", req.url);
  req.setEncoding("utf-8");
  let data_total = null;
  let i = 0;
  req.on("data", (data) => {
    data_total = data_total ? data_total.concat(data) : data;
    logger.info(data_total);
    logger.info(`第${i++}次接收到数据`);
  });

  req.on("end", async () => {
    await downloadFile(client, data_total, page_url);
    await pipeFile(res);
  });
});

// 启动服务器
server.listen(5252, async () => {
  // 创建日志
  logger = createLogger({
    level: "info",
    format: format.json(),
    defaultMeta: { service: "rayso-service" },
    transports: [
      new transports.File({ filename: "error.log", level: "error" }),
      new transports.File({ filename: "combined.log" }),
    ],
  });
  // 判断 chrome 是否启动
  while (!client) {
    try {
      client = await browser();
      logger.info("chrome 启动成功");
    } catch (error) {
      logger.error(error);
    }
  }
});
