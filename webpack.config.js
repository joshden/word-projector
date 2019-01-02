const path = require('path');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const clientSrc = path.resolve(__dirname, 'src-client');

module.exports = {
    mode: 'development',
    entry: {
        main: path.resolve(clientSrc, 'main.ts'),
        presentation: path.resolve(clientSrc, 'presentation.ts'),
        sockettest: path.resolve(clientSrc, 'sockettest.ts')
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader'
                ]
            },
            {
                test: /\.(svg)$/,
                use: ['file-loader']
            },
            {
                test: /\.(woff|woff2|eot|ttf|otf)$/,
                use: ['file-loader']
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    output: {
        // filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist')
    },
    optimization: {
        splitChunks: {
            chunks: 'all'
        }
    },
    plugins: [
        new CleanWebpackPlugin(['dist']),
        new HtmlWebpackPlugin({
            chunks: ['main'],
            template: path.resolve(clientSrc, 'index.html'),
            filename: 'index.html'
        }),
        new HtmlWebpackPlugin({
            chunks: ['presentation'],
            template: path.resolve(clientSrc, 'presentation.html'),
            filename: 'presentation.html'
        }),
        new HtmlWebpackPlugin({
            chunks: ['sockettest'],
            template: path.resolve(clientSrc, 'sockettest.html'),
            filename: 'sockettest.html'
        }),
    ],
    node: {}
};
