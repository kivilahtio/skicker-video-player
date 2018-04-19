const path = require('path');
const merge = require('webpack-merge');
const webpack = require('webpack');

const CleanWebpackPlugin = require('clean-webpack-plugin');
const HtmlWebpackPlugin  = require('html-webpack-plugin');
const CopyWebpackPlugin  = require('copy-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');



//NODE_ENV defaults to 'development'
var NODE_ENV = process.env.NODE_ENV;
if (!NODE_ENV) NODE_ENV = "development";

/*
  Define environment specific values for
  development | testing | production
*/
var buildDir;
var entry;
switch (NODE_ENV) {
  case "production":
    title = "Skicker Video Player";
    buildDir = "./dist/prod";
    entry = {
      app:     './src/app.ts',
    };
    sourceMap = false;
    ts_configFile = "tsconfig.production.json";
    break;

  case "development":
    title = "Skicker Video Player Development";
    buildDir = "./dist/dev";
    entry = {
      app: [
        './src/app.ts',
        'webpack-hot-middleware/client?path=/__webpack_hmr&timeout=20000',
      ]
    };
    sourceMap = true;
    ts_configFile = "tsconfig.development.json";
    break;

  case "testing":
    title = "Skicker Video Player Testing";
    buildDir = "./dist/test";
    entry = {
      tests: [
        './test/specRoot.ts',
        'webpack-hot-middleware/client?path=/__webpack_hmr&timeout=20000',
      ]
    };
    sourceMap = true;
    ts_configFile = "tsconfig.testing.json";
    break;

  default:
    throw new Error("Environment variable NODE_ENV '"+process.env.NODE_ENV+"' is not oneOf ['production', 'development', 'testing']");
}


/*
  Define a shared configuration for all environments
*/
var webpackCommonConfig = {
  entry: entry,
  output: {
    filename:   '[name].bundle.js',
    path:       path.resolve(__dirname, buildDir),
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json', '.yaml']
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: 'style-loader',
            options: {
              hmr: sourceMap,
              sourceMap: sourceMap
            }
          },
          {
            loader: 'css-loader',
            options: {
              sourceMap: sourceMap,
              singleton: true,
            }
          },
        ],
      },
      {
        test: /\.(png|svg|jpg|gif|mp4)$/,
        use: [
          'file-loader'
        ]
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        use: [
          'file-loader'
        ]
      },
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: ts_configFile,
            }
          },
          'tslint-loader',
        ],
//        exclude: /node_modules/
      },
      {
        test: /\.yaml$/,
        use: [
          'json-loader', // Load YAML as JSON and make a POJO for easy consumption
          'yaml-loader',
        ]
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin([buildDir]),
    new HtmlWebpackPlugin({
      title:    title,
      filename: "index.html",
      template: "./src/index.html.lodash",
      inject: true,
      hash: true,
      NODE_ENV: NODE_ENV,
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': "'"+NODE_ENV+"'",
    }),
  ],
};



/*
  Merge environment specific configurations over the common config

*/

var webpackConfig;
switch (NODE_ENV) {
  case "production":

    if (!process.env.WEBPACK_PUBLIC_PATH)
      throw new Error("Environment variable WEBPACK_PUBLIC_PATH '"+process.env.WEBPACK_PUBLIC_PATH+
                      "' is not defined. This should be the public base url of the website.");

    webpackConfig = merge(webpackCommonConfig, {
      output: {
        publicPath: process.env.WEBPACK_PUBLIC_PATH,
      },
      plugins: [
        new UglifyJsPlugin({
          sourceMap: sourceMap,
          uglifyOptions: {
            mangle: true,
          },
        }),
      ]
    });

    break;


  case "development":

    webpackConfig = merge(webpackCommonConfig, {
      devtool: 'inline-source-map',
      devServer: {
        contentBase: buildDir,
        hot: true,
        port: 5000,
      },
      plugins: [
        new webpack.NamedModulesPlugin(),
        new webpack.HotModuleReplacementPlugin(),
        new webpack.NoEmitOnErrorsPlugin(),
      ]
    });

    break;


  case "testing":

    webpackConfig = merge(webpackCommonConfig, {
      devtool: 'inline-source-map',
      devServer: {
        contentBase: buildDir,
        hot: true,
        port: 5001,
      },
      plugins: [
        new webpack.NamedModulesPlugin(),
        new webpack.HotModuleReplacementPlugin(),
        new webpack.NoEmitOnErrorsPlugin(),
        new CopyWebpackPlugin([
          { from: 'node_modules/jasmine-core/lib/jasmine-core/jasmine.css',     to: 'jasmine/' },
          { from: 'node_modules/jasmine-core/lib/jasmine-core/jasmine.js',      to: 'jasmine/' },
          { from: 'node_modules/jasmine-core/lib/jasmine-core/jasmine-html.js', to: 'jasmine/' },
          { from: 'node_modules/jasmine-core/lib/jasmine-core/json2.js',        to: 'jasmine/' },
          { from: 'node_modules/jasmine-core/lib/jasmine-core/boot.js',         to: 'jasmine/' },
        ]),
      ],
    });

    break;


  default:
    throw new Error("Environment variable NODE_ENV '"+process.env.NODE_ENV+"' is not oneOf ['production', 'development', 'testing']");
}


module.exports = webpackConfig;
