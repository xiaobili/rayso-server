const path = require("path");

module.exports = {
  target: "node",
  mode: "production",
  entry: "./server.js", // 指定入口文件
  output: {
    path: path.resolve(__dirname, "dist"), // 输出目录
    filename: "bundle.js", // 输出文件名
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
    ],
  },
};
