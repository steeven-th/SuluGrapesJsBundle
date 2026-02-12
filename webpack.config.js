const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const WebpackBuildNotifierPlugin = require('webpack-build-notifier');


const isProjectBuild = process.env.BUILD_TARGET === 'project';
const isWatch = process.env.WEBPACK_WATCH === 'true';
const isDev = isWatch || process.env.NODE_ENV !== 'production';

const outputPath = isProjectBuild
    ? path.resolve(__dirname, '../../../public/bundles/itechworldsulugrapesjs/builder')
    : path.resolve(__dirname, 'public/builder');
module.exports = {
    mode: isDev ? 'development' : 'production',
    devtool: isDev ? 'eval-source-map' : 'source-map',
    context: path.resolve(__dirname, 'assets/builder'),
    entry: {
        'grape-builder': './app.js',        // Main JS
        'grapesjs': './grapesjs.css.js',    // Base CSS
        'custom': './custom.scss.js',       // Custom CSS
    },
    output: {
        path: outputPath,
        filename: '[name].js',
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
            },
            {
                test: /\.s[ac]ss$/i, // scss or sass
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                    'sass-loader',
                ],
            },
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: '[name].css',
        }),
        new WebpackBuildNotifierPlugin({
            title: "Sulu GrapeJS Bundle",
            suppressSuccess: false,
            sound: true,
        }),
    ],
    optimization: {
        minimize: !isDev,
    },
    watch: isWatch,
    watchOptions: {
        ignored: /node_modules/,
    },
};