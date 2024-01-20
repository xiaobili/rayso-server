const { randomUUID } = require("crypto");
const http = require("http");
const puppeteer = require("puppeteer");
const { join } = require("path");
const { watch, rename, createReadStream } = require("fs");
const { createLogger, format, transports } = require("winston");

let client = null;
let logger = null;

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

const downloadFile = async (client, data_total) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (data_total) {
        data_total = JSON.parse(data_total);
        const page = await client.newPage();
        await page.goto(
          `https://ray.so/#background=${data_total.background}&darkMode=${data_total.darkMode}&theme=${data_total.theme}&padding=${data_total.padding}&code=${data_total.code}`
        );

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

const pipeFile = async (res) => {
  res.writeHead(200, {
    "Content-Type": "octet-stream",
    "Content-Disposition": "attachment; filename=ray-so-export.png",
  });
  const readStream = createReadStream(
    join(__dirname, "downloads", "pics", "ray-so-export.png")
  );
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

const server = http.createServer(async (req, res) => {
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
    await downloadFile(client, data_total);
    await pipeFile(res);
  });
});

server.listen(5252, async () => {
  client = await browser();
  client
    .target()
    .createCDPSession()
    .then((session) => {
      session.send("Browser.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: "./downloads/pics",
      });
    });
  logger = createLogger({
    level: "info",
    format: format.json(),
    defaultMeta: { service: "rayso-service" },
    transports: [
      new transports.File({ filename: "error.log", level: "error" }),
      new transports.File({ filename: "combined.log" }),
    ],
  });
});
