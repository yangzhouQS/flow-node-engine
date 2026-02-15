import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";
import nodeExternals from "webpack-node-externals";
import { RunScriptWebpackPlugin } from 'run-script-webpack-plugin';
import { TsCheckerRspackPlugin } from 'ts-checker-rspack-plugin';

const isDev = process.env.NODE_ENV === "development";

const runScriptOptions = {
  autoRestart: true,
  cwd: process.cwd(),
  name: 'main.js',
  restartable: true,
  args: [isDev ? '--inspect' : "--inspect"],
  nodeArgs: ["--inspect"]
};


export default defineConfig({
  mode: (process.env.NODE_ENV ) || "none",
  entry: {
    main: "./src/main.ts"
  },
  target: "node",
  optimization: {
    nodeEnv: false,
    minimizer: [
      new rspack.SwcJsMinimizerRspackPlugin({
        minimizerOptions: {
          compress: {
            keep_classnames: true,
            keep_fnames: true,
          },
          mangle: {
            keep_classnames: true,
            keep_fnames: true,
          },
        },
      }),
    ],
  },
  devtool: "source-map",
  resolve: {
    extensions: ["...", ".ts", ".json"]
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: "builtin:swc-loader",
          options: {
            jsc: {
              parser: {
                syntax: "typescript",
                decorators: true,
              },
              transform: {
                legacyDecorator: true,
                decoratorMetadata: true,
              },
            },
          },
        },
      },
    ],
  },
  plugins: [
    new rspack.ProgressPlugin(),
    isDev && new RunScriptWebpackPlugin(runScriptOptions),
    isDev && new rspack.DefinePlugin({}),
    new TsCheckerRspackPlugin()
  ].filter(Boolean),
  externalsType: "commonjs",
  ignoreWarnings: [/^(?!CriticalDependenciesWarning$)/],
  externals: [nodeExternals()],
  externalsPresets: { node: true },
  output: {
    filename: "[name].js",
    chunkFilename: "[name].js",
    clean: true,
  },
  experiments: {
  },
  devServer: {
    hot: true,
    devMiddleware: {
      writeToDisk: true,
    },
    proxy: []
  }
});
