'use strict';

var webpack = require('webpack'),
    HtmlWebpackPlugin = require('html-webpack-plugin'),
    path = require('path'),
    srcPath = path.join(__dirname, 'client/src')
;

module.exports = {
    target: 'web',
    cache: true,
    entry: {
        module: path.join(srcPath, 'module.jsx')
    },
    resolve: {
        root: __dirname,
        extensions: ["", ".js", ".jsx"],
        modulesDirectories: ["node_modules", "src"]
    },
    output: {
        path: path.join(__dirname, 'client/dist'),
        filename: 'module.js'
    },

    module: {
        loaders: [
            {test: /\.(js|jsx)?$/, exclude: /node_modules/, loader: "babel"},
            {test: /\.css$/, loader: "style-loader!css-loader"},
            // For bootstrap icons
            { test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/, loader: "url-loader?limit=10000&minetype=application/font-woff" },
            { test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/, loader: "file-loader" }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            inject: true,
            template: './client/src/index.html',
            hash: true
        }),
        new webpack.DefinePlugin({
            'process.env': {
                'NODE_ENV': JSON.stringify("development")
            }
        })
    ],

    debug: true,
    bail: true,
    devtool: 'source-map',
    devServer: {
        contentBase: './client/dist',
        historyApiFallback: true
    },
    babel: {
        "presets": [
            "es2015",
            "stage-1",
            "react"
        ],
        "comments": false
    }
};

